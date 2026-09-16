# 報告画像の GPT Image 2.5 向けプロンプト設計と活用案

作成日: 2026-09-16
関連: `docs/plans/2026-09-16-gpt-image-25-report-cost-simulation.md`(コスト試算)

**このドキュメントは設計案であり、コードは実装していない。**
掲載しているプロンプトはそのままコピーして使える完成形だが、アプリ本体への
組み込み(`app/api/gemini/generate-image/route.ts` の分岐変更など)は
一切行っていない。採用可否を判断してから実装に進むこと。

---

## 0. 前提として判明した事実

`textInImage` フラグ(GPT Image へ振り分ける唯一の条件)を立てているのは
**テストコードだけ**で、クライアントからは一度もセットされていない。

```
app/api/gemini/generate-image/route.ts:141   const textInImage = form.get("textInImage") === "true"
tests/unit/app/api/gemini-generate-image-route.test.ts:174   form.append("textInImage", "true")
→ components/ 配下でのセット箇所: 0件
```

つまり **OpenAI 経路は本番で死んでいる**。日本語ラベル描画のために用意した経路が、
肝心の日本語ラベル入り画像(viz オーバーレイ)に使われていない。
ここが今回いちばん費用対効果の高い改善点になる。

## 1. 結論 — 最適な構成

| 画像種別 | モデル | quality | size | 根拠 |
| --- | --- | --- | --- | --- |
| **viz(ハザード注釈オーバーレイ)** | `gpt-image-2.5-sunburst` | `high` | `auto` | 日本語ラベル4種 + 凡例 + 番号バッジ。小さな文字と図版レイアウトが要求される唯一の画像。ガイドが「dense labels / diagrams は `high`」と明示 |
| **災害シミュレーション4種** | `gpt-image-2.5-flare` or 現行 Gemini 継続 | `medium` | `auto` | 文字を一切含まない写実編集。Flare は「GPT Image 2 同等品質で高速」= この用途の要件 |
| **ピクトグラム素材** | `gpt-image-2.5-flare` | `medium` | `1024x1024` | 1回生成して保存・再利用。`background="transparent"` |

`input_fidelity` は **指定しない**(GPT Image 2 以降は常に high fidelity)。
`output_compression` は PNG では使用不可。

### なぜ viz だけを GPT Image 2.5 に出すのか

コスト試算(報告1,000件/月、`npx tsx scripts/simulate-gpt-image-25-cost.ts`):

| 構成 | 月次 | 現行比 |
| --- | --- | --- |
| 現行(全部 Gemini Lite) | $193.20 | 1.00x |
| ハイブリッド: viz=2.5 **low** / sim=Gemini | $184.46 | 0.95x |
| ハイブリッド: viz=2.5 **medium** / sim=Gemini | $238.52 | 1.23x |
| **ハイブリッド: viz=2.5 `high` / sim=Gemini** | **$420.20** | **2.17x** |
| 全枚数 2.5 medium | $419.81 | 2.17x |

**viz だけを最高品質にしても、全枚数を medium にするのとほぼ同額**($420 vs $420)。
同じ予算なら、文字が一切出ない写実シミュレーション4枚を底上げするより、
日本語ラベルが出る1枚に全部振ったほうが成果物の質は上がる。

## 2. プロンプト設計 — ガイドからの適用点

既存プロンプト(`lib/disaster-image-prompt-fallbacks.ts`)は 1 段落に全制約を
詰め込んだ密な英文で、Gemini 向けにはよくチューニングされている。
GPT Image 2.5 ガイドに沿って変えたのは次の5点:

| ガイドの指針 | 適用 |
| --- | --- |
| 複雑な要求は scene / subject / details / constraints の**ラベル付きセクション**に分ける | `TASK` / `DELIVERABLE` / `MARKERS TO DRAW` / `LEGEND` / `TYPOGRAPHY` / `MUST NOT CHANGE` / `TEXT RULE` / `DO NOT ADD` に分割 |
| 参照画像に**役割を明示**する | 冒頭で `Image 1 is ... and is the immutable base image` と宣言し、以降すべて "Image 1" で参照 |
| 変更点と制約を**分離**する("change only X" + 保持項目の列挙) | `MUST NOT CHANGE` を独立セクション化し、検証可能なチェックリスト形式にした |
| 正確な文字列は**引用符 + 出現回数**を指定する | CLOSED TEXT SET を箇条書きにし、`each appearing exactly once` を明記 |
| 図版は**instructional design brief** として書く | `DELIVERABLE` に「自治体の交通安全チラシのような図版」と成果物イメージを与えた |

**既存の安全不変条件はすべて維持**している(元写真の編集であること / アスペクト比維持 /
顔・ナンバーの匿名化 / CLOSED TEXT SET / 未確認の子ども110番の家を描き足さない /
画像プロンプトに児童への言及を書かない / 惨事的表現の禁止)。

### プレースホルダの埋め方

以下のプロンプト本文中の `{{...}}` は、既存の generate-prompts API が返す値で置換する。

| プレースホルダ | 供給元 | 例 |
| --- | --- | --- |
| `{{ANCHOR_n}}` | Step 1 の `riskObservation.elements` を verbatim | `concrete block wall (right, foreground)` |
| `{{OBJECT}}` | `structureConditions[].object` | `concrete block wall (right, foreground)` |
| `{{MATERIAL}}` | `structureConditions[].material` | `concrete block` |
| `{{MAX_DAMAGE}}` | `structureConditions[].maxDamage`(tier から導出) | `a few visible cracks, slight rigid lean, small fallen fragments` |
| `{{SUBJECT}}` / `{{ACCENT_COLOR}}` | ピクトグラムの主題と配色 | `a leaning concrete block wall` / `red` |

**組み立て時の必須ルール**(実装する場合、プロンプト文面ではなくコード側で担保すること):

- 写真内に実在が確認できたハザードが **0件なら viz を生成しない**。
  「根拠のないラベルを貼らない」は指示文ではなく呼び出し側のガードで守る。
- マーカーは **最大4件**。`MARKERS TO DRAW (exactly N, ...)` の N と実際の項目数、
  および `LEGEND` の凡例文字列は、実際に使った色だけに揃える。
- `CLOSED TEXT SET` の列挙は、描画するラベルと凡例行と完全に一致させる。
  ここがズレると「許可した覚えのない文字」が出る余地を作る。

---

## 3. プロンプト本文(完成形)

### 3-1. viz — ハザード注釈オーバーレイ

用途: 元写真の上に平面の注釈レイヤーを重ねる。**日本語ラベルが出る唯一の画像**。
推奨: `gpt-image-2.5-sunburst` / `quality="high"` / `size="auto"`

下記はハザード4件すべてを使う最大構成。実際には写真内に根拠がある分だけに減らし、
番号・凡例・CLOSED TEXT SET を連動させて削ること。

```text
TASK
Image 1 is a photograph of a Japanese school route and is the immutable base image. Add a flat 2D hazard-annotation overlay layer on top of it. This is an image-EDITING task, not scene creation: do not redraw, repaint, move, remove, or re-synthesise anything in the underlying photograph. Every area not covered by an overlay graphic must remain identical to Image 1.

DELIVERABLE
The result should read like a clean digital safety infographic laid over a real photo — the kind used in a municipal road-safety handout. The overlays are flat vector graphics sitting ON the image; they must never look like physical signs, paint, or objects present inside the scene.

MARKERS TO DRAW (exactly 4, no more, no fewer)
1. Anchor: {{ANCHOR_1}}
   Shape: semi-transparent red polygon at about 40% fill opacity with a solid red outline, hugging that object's silhouette exactly.
   Badge: a circular badge carrying the white numeral "1" on red, connected to the shape by a short leader line.
   Label: "フェンス倒壊注意" on a high-contrast rounded pill placed directly beside the badge, on or immediately next to the anchor object.
2. Anchor: {{ANCHOR_2}}
   Shape: semi-transparent red polygon at about 40% fill opacity with a solid red outline, hugging that object's silhouette exactly.
   Badge: a circular badge carrying the white numeral "2" on red, connected to the shape by a short leader line.
   Label: "電柱倒壊注意" on a high-contrast rounded pill placed directly beside the badge, on or immediately next to the anchor object.
3. Anchor: {{ANCHOR_3}}
   Shape: semi-transparent blue wash at about 40% fill opacity with a solid blue outline, hugging that object's silhouette exactly.
   Badge: a circular badge carrying the white numeral "3" on blue, connected to the shape by a short leader line.
   Label: "冠水注意" on a high-contrast rounded pill placed directly beside the badge, on or immediately next to the anchor object.
4. Anchor: {{ANCHOR_4}}
   Shape: semi-transparent amber tint at about 40% fill opacity with a solid amber outline, hugging that object's silhouette exactly.
   Badge: a circular badge carrying the white numeral "4" on amber, connected to the shape by a short leader line.
   Label: "延焼注意" on a high-contrast rounded pill placed directly beside the badge, on or immediately next to the anchor object.

LEGEND
Place one compact legend on a small opaque rounded panel in the bottom-left corner, reading exactly: "凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意". List only the colours actually used above.

TYPOGRAPHY
All Japanese text must be crisp, correctly formed, and legible at mobile screen size. Prefer slightly larger type over dense type. Each label sits on its pill with balanced padding and does not overflow or clip.

MUST NOT CHANGE (verify each before returning):
- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.
- Every pixel region you were not explicitly instructed to change above.
- The position, geometry, colour, and material of every structure in the photograph.
- The original daylight, weather, and colour balance, except where an instruction above requires otherwise.

ANONYMISATION (apply before anything else):
- If any human face is visible, repaint it as an unrecognisable soft blur covering the whole face.
- If any licence plate is visible, repaint the entire plate as a blank surface carrying no characters.

TEXT RULE:
CLOSED TEXT SET — the output may contain ONLY these strings, each rendered glyph-for-glyph in a clean bold Japanese gothic (sans-serif) typeface, each appearing exactly once:
  - "フェンス倒壊注意"
  - "電柱倒壊注意"
  - "冠水注意"
  - "延焼注意"
  - "凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意"
No other character of any script may appear anywhere in the image: no alphabet, no captions, no watermarks, no model names, and no deformed kanji-like glyphs. Real-world signage already present in Image 1 stays exactly as photographed.

DO NOT ADD:
- Do not add any new kodomo-110-ban-no-ie marker, plaque, or yellow triangular safe-house sign, or any other street furniture, signage, or safety marker that is not visible in the source photo. Preserve any such item already visible in the source photo unchanged.
- No people, no added vehicles, no new street furniture, no new signage.
- No gore, no injured persons, no scattered personal belongings.
- No cinematic treatment: no motion blur, dutch angle, vignette, lens flare, darkened sky, or desaturated "disaster movie" grading.
```

実測 4,438 文字 ≒ 1,200 トークン(テキスト入力 $5/M なので約 $0.006/枚)。
---

### 3-2. 災害シミュレーション(4種)

用途: 同一地点を災害時の状態に写実編集する。**文字は一切入れない**。
推奨: `gpt-image-2.5-flare` / `quality="medium"` / `size="auto"`

4種とも `DAMAGE BUDGET` に condition ledger を差し込む構造が共通。
ここを表形式で渡すことで「damaged walls」のような一般語を構造的に出せなくしている。

#### 地震(震度5強相当)

```text
TASK
Image 1 is a photograph of a Japanese suburban street and is the base image. Edit it so the same place is shown under the condition described below. Keep the exact camera position, framing, lens, daylight, and the original aspect ratio. Keep every structure in its original position. Change ONLY what the sections below describe.

CONDITION TO DEPICT
Show the same place moments after a moderate earthquake (JMA seismic intensity 5-upper — strong but not catastrophic). The scene must read as "shaken but standing".

HOW THE CHANGE MUST BEHAVE
- Cracks follow structural logic: stair-step along mortar joints, or radiating from corners and openings.
- Pavement cracks only along seams that already exist in the photograph.
- Tilting objects rotate rigidly at their base. Never bend a pole or post mid-span.
- Fallen fragments lie directly below the point they came from.
- A thin dust film appears only immediately around fresh cracks.

DAMAGE BUDGET (binding — do not exceed any line)
Apply damage strictly proportional to each structure's actual visible condition in Image 1. No structure may receive damage stronger than its stated maximum. If every structure is "new", the whole scene must look nearly intact with only subtle traces — do NOT dramatise to make the image more striking.
- {{OBJECT}} — material: {{MATERIAL}}; condition: aging; MAXIMUM permitted damage: {{MAX_DAMAGE}}
Name the structures you change and apply exactly the damage listed. Generic outcomes such as "damaged walls" or "debris everywhere" are forbidden.

READABILITY REQUIREMENT
The damage must read as discrete, pointable clues — a crack HERE, water up to HERE — and not as a general atmosphere of devastation. The street must stay instantly recognisable as the same place: keep the layout, the colours, and every undamaged structure identical.

RENDERING
Photorealistic, sharp focus, normal daylight, calm matter-of-fact documentary tone, as if taken by the same camera as Image 1.

FORBIDDEN FOR THIS CONDITION: No explosion-like destruction, no dramatic dust clouds, no collapsed buildings, no darkened sky, no horror mood.

MUST NOT CHANGE (verify each before returning):
- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.
- Every pixel region you were not explicitly instructed to change above.
- The position, geometry, colour, and material of every structure in the photograph.
- The original daylight, weather, and colour balance, except where an instruction above requires otherwise.

ANONYMISATION (apply before anything else):
- If any human face is visible, repaint it as an unrecognisable soft blur covering the whole face.
- If any licence plate is visible, repaint the entire plate as a blank surface carrying no characters.

TEXT RULE:
This image must contain NO text of any kind: no lettering, numerals, captions, watermarks, or model names in any script. Real-world signage already present in Image 1 stays exactly as photographed and must not be redrawn or made more legible.

DO NOT ADD:
- Do not add any new kodomo-110-ban-no-ie marker, plaque, or yellow triangular safe-house sign, or any other street furniture, signage, or safety marker that is not visible in the source photo. Preserve any such item already visible in the source photo unchanged.
- No people, no added vehicles, no new street furniture, no new signage.
- No gore, no injured persons, no scattered personal belongings.
- No cinematic treatment: no motion blur, dutch angle, vignette, lens flare, darkened sky, or desaturated "disaster movie" grading.
```

#### 台風(最大風速 約30m/s)

```text
TASK
Image 1 is a photograph of a Japanese suburban street and is the base image. Edit it so the same place is shown under the condition described below. Keep the exact camera position, framing, lens, daylight, and the original aspect ratio. Keep every structure in its original position. Change ONLY what the sections below describe.

CONDITION TO DEPICT
Show the same place right after typhoon-class wind (sustained about 30 m/s — strong but survivable).

HOW THE CHANGE MUST BEHAVE
- Choose ONE wind direction first, then make every single cue agree with it.
- Leaves and small broken branches accumulate on the downwind side.
- MASS RULE: only objects a person could lift are displaced — bins, cones, potted plants topple or shift downwind. Anchored structures at most tilt slightly.
- Flexible signs and mesh fences bow slightly downwind but stay standing.
- Pavement is rain-wet with a dull sheen. Sky overcast but still normal daylight.

DAMAGE BUDGET (binding — do not exceed any line)
Apply damage strictly proportional to each structure's actual visible condition in Image 1. No structure may receive damage stronger than its stated maximum. If every structure is "new", the whole scene must look nearly intact with only subtle traces — do NOT dramatise to make the image more striking.
- {{OBJECT}} — material: {{MATERIAL}}; condition: aging; MAXIMUM permitted damage: {{MAX_DAMAGE}}
Name the structures you change and apply exactly the damage listed. Generic outcomes such as "damaged walls" or "debris everywhere" are forbidden.

READABILITY REQUIREMENT
The damage must read as discrete, pointable clues — a crack HERE, water up to HERE — and not as a general atmosphere of devastation. The street must stay instantly recognisable as the same place: keep the layout, the colours, and every undamaged structure identical.

RENDERING
Photorealistic, sharp focus, normal daylight, calm matter-of-fact documentary tone, as if taken by the same camera as Image 1.

FORBIDDEN FOR THIS CONDITION: No uprooted trees, no destroyed buildings, no debris flying in mid-air, no darkened dramatic sky, no catastrophic damage.

MUST NOT CHANGE (verify each before returning):
- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.
- Every pixel region you were not explicitly instructed to change above.
- The position, geometry, colour, and material of every structure in the photograph.
- The original daylight, weather, and colour balance, except where an instruction above requires otherwise.

ANONYMISATION (apply before anything else):
- If any human face is visible, repaint it as an unrecognisable soft blur covering the whole face.
- If any licence plate is visible, repaint the entire plate as a blank surface carrying no characters.

TEXT RULE:
This image must contain NO text of any kind: no lettering, numerals, captions, watermarks, or model names in any script. Real-world signage already present in Image 1 stays exactly as photographed and must not be redrawn or made more legible.

DO NOT ADD:
- Do not add any new kodomo-110-ban-no-ie marker, plaque, or yellow triangular safe-house sign, or any other street furniture, signage, or safety marker that is not visible in the source photo. Preserve any such item already visible in the source photo unchanged.
- No people, no added vehicles, no new street furniture, no new signage.
- No gore, no injured persons, no scattered personal belongings.
- No cinematic treatment: no motion blur, dutch angle, vignette, lens flare, darkened sky, or desaturated "disaster movie" grading.
```

#### 浸水(15〜20cm)

```text
TASK
Image 1 is a photograph of a Japanese suburban street and is the base image. Edit it so the same place is shown under the condition described below. Keep the exact camera position, framing, lens, daylight, and the original aspect ratio. Keep every structure in its original position. Change ONLY what the sections below describe.

CONDITION TO DEPICT
Show the same place during shallow urban flooding of 15-20 cm (ankle to shin depth).

HOW THE CHANGE MUST BEHAVE
- Render ONE horizontally consistent waterline across the entire scene.
- Calibrate it to real anchors visible in the photograph: a standard curb is about 15 cm high, so the water just reaches the curb top. Wall bases and fence posts stand in the water.
- The water is silty brown and opaque enough to hide the road markings beneath it, with small ripples and matte, broken reflections of the poles and walls above.
- Add floating leaves and light debris, and a damp high-water stain a few centimetres above the waterline on walls and curbs.
- Everything above the waterline stays exactly as in Image 1.

DAMAGE BUDGET (binding — do not exceed any line)
Apply damage strictly proportional to each structure's actual visible condition in Image 1. No structure may receive damage stronger than its stated maximum. If every structure is "new", the whole scene must look nearly intact with only subtle traces — do NOT dramatise to make the image more striking.
- {{OBJECT}} — material: {{MATERIAL}}; condition: aging; MAXIMUM permitted damage: {{MAX_DAMAGE}}
Name the structures you change and apply exactly the damage listed. Generic outcomes such as "damaged walls" or "debris everywhere" are forbidden.

READABILITY REQUIREMENT
The damage must read as discrete, pointable clues — a crack HERE, water up to HERE — and not as a general atmosphere of devastation. The street must stay instantly recognisable as the same place: keep the layout, the colours, and every undamaged structure identical.

RENDERING
Photorealistic, sharp focus, normal daylight, calm matter-of-fact documentary tone, as if taken by the same camera as Image 1.

FORBIDDEN FOR THIS CONDITION: No deep water, no submerged cars, no waves or torrents, no falling rain streaks, no dark stormy mood.

MUST NOT CHANGE (verify each before returning):
- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.
- Every pixel region you were not explicitly instructed to change above.
- The position, geometry, colour, and material of every structure in the photograph.
- The original daylight, weather, and colour balance, except where an instruction above requires otherwise.

ANONYMISATION (apply before anything else):
- If any human face is visible, repaint it as an unrecognisable soft blur covering the whole face.
- If any licence plate is visible, repaint the entire plate as a blank surface carrying no characters.

TEXT RULE:
This image must contain NO text of any kind: no lettering, numerals, captions, watermarks, or model names in any script. Real-world signage already present in Image 1 stays exactly as photographed and must not be redrawn or made more legible.

DO NOT ADD:
- Do not add any new kodomo-110-ban-no-ie marker, plaque, or yellow triangular safe-house sign, or any other street furniture, signage, or safety marker that is not visible in the source photo. Preserve any such item already visible in the source photo unchanged.
- No people, no added vehicles, no new street furniture, no new signage.
- No gore, no injured persons, no scattered personal belongings.
- No cinematic treatment: no motion blur, dutch angle, vignette, lens flare, darkened sky, or desaturated "disaster movie" grading.
```

#### 火災(発生源はフレーム外)

```text
TASK
Image 1 is a photograph of a Japanese suburban street and is the base image. Edit it so the same place is shown under the condition described below. Keep the exact camera position, framing, lens, daylight, and the original aspect ratio. Keep every structure in its original position. Change ONLY what the sections below describe.

CONDITION TO DEPICT
Show subtle signs that a small fire is burning somewhere strictly OUTSIDE the frame. The street itself is not burning and no flame is visible anywhere.

HOW THE CHANGE MUST BEHAVE
- Choose the off-frame direction of the fire first, then keep every cue consistent with it.
- A translucent smoke haze is densest toward that edge of the frame and thins across the scene.
- Faint soot appears only on surfaces facing that direction.
- A slight warm tint is confined to the haze itself. Every surface keeps its normal daylight colour — no orange glow, no rim light.
- Distant objects are slightly softened by the haze while the foreground stays clear.

DAMAGE BUDGET (binding — do not exceed any line)
Apply damage strictly proportional to each structure's actual visible condition in Image 1. No structure may receive damage stronger than its stated maximum. If every structure is "new", the whole scene must look nearly intact with only subtle traces — do NOT dramatise to make the image more striking.
- {{OBJECT}} — material: {{MATERIAL}}; condition: aging; MAXIMUM permitted damage: {{MAX_DAMAGE}}
Name the structures you change and apply exactly the damage listed. Generic outcomes such as "damaged walls" or "debris everywhere" are forbidden.

READABILITY REQUIREMENT
The damage must read as discrete, pointable clues — a crack HERE, water up to HERE — and not as a general atmosphere of devastation. The street must stay instantly recognisable as the same place: keep the layout, the colours, and every undamaged structure identical.

RENDERING
Photorealistic, sharp focus, normal daylight, calm matter-of-fact documentary tone, as if taken by the same camera as Image 1.

FORBIDDEN FOR THIS CONDITION: No flames, no burning or charred objects, no thick black smoke filling the sky, no apocalyptic mood.

MUST NOT CHANGE (verify each before returning):
- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.
- Every pixel region you were not explicitly instructed to change above.
- The position, geometry, colour, and material of every structure in the photograph.
- The original daylight, weather, and colour balance, except where an instruction above requires otherwise.

ANONYMISATION (apply before anything else):
- If any human face is visible, repaint it as an unrecognisable soft blur covering the whole face.
- If any licence plate is visible, repaint the entire plate as a blank surface carrying no characters.

TEXT RULE:
This image must contain NO text of any kind: no lettering, numerals, captions, watermarks, or model names in any script. Real-world signage already present in Image 1 stays exactly as photographed and must not be redrawn or made more legible.

DO NOT ADD:
- Do not add any new kodomo-110-ban-no-ie marker, plaque, or yellow triangular safe-house sign, or any other street furniture, signage, or safety marker that is not visible in the source photo. Preserve any such item already visible in the source photo unchanged.
- No people, no added vehicles, no new street furniture, no new signage.
- No gore, no injured persons, no scattered personal belongings.
- No cinematic treatment: no motion blur, dutch angle, vignette, lens flare, darkened sky, or desaturated "disaster movie" grading.
```
---

### 3-3. 透過ピクトグラム素材

用途: 地図マーカー・レポートPDFのアイコン・凡例記号。**1回生成して保存し再利用する**。
推奨: `gpt-image-2.5-flare` / `quality="medium"` / `size="1024x1024"` /
`background="transparent"` / `output_format="png"`(`output_compression` は指定しない)

```text
TASK
Create an original, non-infringing safety pictogram of {{SUBJECT}}, for use as a map marker and report icon in a Japanese road-safety application.

STYLE
Flat vector design, a single strong silhouette, minimal strokes, balanced negative space, no gradients. Use {{ACCENT_COLOR}} as the single accent colour over a neutral dark grey. Favour simplicity over detail so it stays readable at 24 px as well as at full size.

COMPOSITION
One centred pictogram with generous even padding on all sides. Fully transparent background with clean alpha edges.

MUST NOT INCLUDE
- No text, lettering, or numerals of any script.
- No solid backdrop, no scenery, no drop shadow, no checkerboard pattern (a drawn checkerboard is not transparency).
- No watermarks, no logos, no trademarked or recognisable third-party symbols.
- No photorealistic rendering — this is a flat icon, not an illustration of a scene.
```
---

## 4. 使い方 — 何ができるようになるか

### 4-1. いますぐ効く

**A. viz オーバーレイの日本語ラベル品質を上げる** ← 最優先
`textInImage=true` をクライアントから立て、3-1 のプロンプトを送る。
現状いちばん崩れやすい「崩れた漢字もどき」「英字透かしの混入」は、
CLOSED TEXT SET をセクション化したうえで GPT Image 2.5 の文字描画に載せるのが
最も確実。+$227/月(1,000件/月時)。

**B. 災害シミュレーションを Flare で置き換える**
3-2 のプロンプトを使う。既存の `structureConditions` をそのまま
`DAMAGE BUDGET` に流し込める形にしてある。ガイドの推奨どおり
「まず Sunburst で品質を確認 → Flare で同品質が出るなら Flare に落とす」順で評価する。

### 4-2. 新しくできるようになること

**C. 透過ピクトグラムの内製(生成コストが実質ゼロになる使い方)**
ハザード種別ごとに**1回だけ**生成して R2 に保存すれば、以後の報告では生成不要。
24種類作っても一度きりの $1.75(medium)。

**D. 多言語版レポート**
ガイドの「Translate while preserving layout」がそのまま使える。
完成した viz 画像を入力に `Translate the text in the overlay to English.
Do not change any other aspect of the image.` で、レイアウトを保ったまま
英語版・やさしい日本語版を作れる。外国籍世帯向けの通学路資料に直結する。

**E. レポート表紙・サマリースライドの自動生成**
ガイドの「Build slides, diagrams, and charts」の書き方(実データを
プロンプトに直接埋め込む)を使えば、`createReportSummary()` が返す
危険箇所の件数・種別内訳をそのまま流し込んだ表紙画像を作れる。
`size="1536x864"`, `quality="high"`。現行の html2canvas 合成の代替ではなく、
**学校向け配布資料の1枚絵**という新しい出力形態。

**F. 同一地点の経時比較**
ガイドの「Refine an image across turns」。生成済み画像を次の入力に渡し
`Make it look like a winter evening.` のような1点だけの追加指示で、
同じ地点の別条件(夜間・積雪・雨天)を安価に揃えられる。
通学路の「見えにくい時間帯」の啓発に使える。

### 4-3. 使わないほうがよいこと

- **顔・ナンバーの匿名化をプロンプトに頼り続けること**。
  ガイドは明確に「ピクセル単位で不変であるべき領域は、プロンプトではなく
  合成で担保せよ」と述べている。現状の
  `if any human face is visible, repaint it...` は生成モデルの気分次第で抜ける。
  `drawOverlayFromHazards` と同じ canvas 前処理で**送信前にローカルでぼかす**のが
  正しい。プロンプト側の指示は二重の保険として残す。
- **`xhigh` / `max`**。公表トークン数が無く、`high`(現行比6.9x)以上であることしか
  分からない。現時点で採用判断はできない。

## 5. 移行手順(ガイドの migration workflow に沿う)

1. **ベースラインを保存**: 現行 Gemini の viz 出力を、日本語ラベルが崩れた失敗例を
   含めて20枚ほど集める。プロンプト・入力写真・結果を記録。
2. **Sunburst で品質を確認**: 同じ入力に 3-1 のプロンプトを当てる。
   確認項目 = ラベルの字形 / CLOSED TEXT SET 違反(余計な文字)の有無 /
   元写真の保持 / アンカー位置の正しさ。
3. **`usage` を記録**してコスト試算を実測値で再実行
   (`--img-in=` `--txt-in=`)。`lib/api-cost-calculator.ts` に
   `gpt-image-2.5-*` の単価を追加する(現状 fallback $0.04 に落ちる)。
4. **Flare で同品質が出るか試す**。出るなら Flare に落としてレイテンシを取る。
5. **段階投入**: viz のみ → 一部トラフィック → 全面。Gemini 経路はロールバック用に残す。

## 6. 未解決・要判断

- 是正再生成(`verifyOrRegenerateImages`)は現状 Gemini 経路のみ。
  GPT Image 2.5 に移す場合、検証ロジック自体はモデル非依存なので有効化できるが、
  再生成率ぶんコストが増える(`--regen` で再試算のこと)。
- Gemini は1リクエストで最大2枚返し UI もそれを使う(`imgs.slice(0, 2)`)。
  GPT Image は `n=1`。viz を移す際は「1枚に減らす」判断が要る。
  減らさず2枚出すならリクエスト2回 = viz のコストは倍。
- 本ドキュメントのプロンプトは**実機未検証**。実際の写真で1回流すまでは
  「設計上こうあるべき」の域を出ない。§5-2 が最初の検証ステップ。
