# 報告画像の GPT Image 2.5 向けプロンプト設計と活用案

作成日: 2026-09-16
関連: `docs/plans/2026-09-16-gpt-image-25-report-cost-simulation.md`(コスト試算)
実装: `lib/gpt-image-25-report-prompts.ts`

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

### 生成されるプロンプト(viz、ハザード2件の例)

```
TASK
Image 1 is a photograph of a Japanese school route and is the immutable base image.
Add a flat 2D hazard-annotation overlay layer on top of it. This is an image-EDITING
task, not scene creation: ...

DELIVERABLE
The result should read like a clean digital safety infographic laid over a real photo
— the kind used in a municipal road-safety handout. ...

MARKERS TO DRAW (exactly 2, no more, no fewer)
1. Anchor: concrete block wall (right, foreground)
   Shape: semi-transparent red polygon at about 40% fill opacity ...
   Badge: a circular badge carrying the white numeral "1" on red ...
   Label: "フェンス倒壊注意" on a high-contrast rounded pill ...

LEGEND
... reading exactly: "凡例 赤=倒壊・落下注意 / 青=冠水注意".

TYPOGRAPHY
All Japanese text must be crisp, correctly formed, and legible at mobile screen size. ...

MUST NOT CHANGE (verify each before returning):
- Framing, field of view, camera position, lens, and the original aspect ratio of Image 1.
- Every pixel region you were not explicitly instructed to change above.
...

TEXT RULE:
CLOSED TEXT SET — the output may contain ONLY these strings, each appearing exactly once:
  - "フェンス倒壊注意"
  - "冠水注意"
  - "凡例 赤=倒壊・落下注意 / 青=冠水注意"
...
```

全文は `lib/gpt-image-25-report-prompts.ts` の `buildVizPrompt()` が生成する。
実測 3,658 文字 ≒ 1,000 トークン(コスト試算の仮定 800 tok に対し +$0.001/枚。誤差範囲)。

`markers` が空なら例外を投げる設計にした。「写真に写っていないものにラベルを貼らない」
という既存の設計原則を、プロンプト文面の指示ではなく**型と実行時ガードで**担保する。

## 3. 使い方 — 何ができるようになるか

### 3-1. いますぐ効く(実装済みの関数を呼ぶだけ)

**A. viz オーバーレイの日本語ラベル品質を上げる** ← 最優先
`textInImage=true` をクライアントから立て、`buildVizPrompt()` の出力を送る。
現状いちばん崩れやすい「崩れた漢字もどき」「英字透かしの混入」は、
CLOSED TEXT SET をセクション化したうえで GPT Image 2.5 の文字描画に載せるのが
最も確実。+$227/月(1,000件/月時)。

**B. 災害シミュレーションを Flare で置き換える**
`buildSimulationPrompt(kind, conditions)` を使う。既存の condition ledger
(`structureConditions`)をそのまま渡せる形にしてある。ガイドの推奨どおり
「まず Sunburst で品質を確認 → Flare で同品質が出るなら Flare に落とす」順で評価する。

### 3-2. 新しくできるようになること

**C. 透過ピクトグラムの内製(生成コストが実質ゼロになる使い方)**
`buildPictogramPrompt()` + `background="transparent"`。
ハザード種別ごとに**1回だけ**生成して R2 に保存すれば、以後の報告では生成不要。
地図マーカー・レポートPDFのアイコン・凡例の記号に再利用できる。
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

### 3-3. 使わないほうがよいこと

- **顔・ナンバーの匿名化をプロンプトに頼り続けること**。
  ガイドは明確に「ピクセル単位で不変であるべき領域は、プロンプトではなく
  合成で担保せよ」と述べている。現状の
  `if any human face is visible, repaint it...` は生成モデルの気分次第で抜ける。
  `drawOverlayFromHazards` と同じ canvas 前処理で**送信前にローカルでぼかす**のが
  正しい。プロンプト側の指示は二重の保険として残す。
- **`xhigh` / `max`**。公表トークン数が無く、`high`(現行比6.9x)以上であることしか
  分からない。現時点で採用判断はできない。

## 4. 移行手順(ガイドの migration workflow に沿う)

1. **ベースラインを保存**: 現行 Gemini の viz 出力を、日本語ラベルが崩れた失敗例を
   含めて20枚ほど集める。プロンプト・入力写真・結果を記録。
2. **Sunburst で品質を確認**: 同じ入力に `buildVizPrompt()` を当てる。
   確認項目 = ラベルの字形 / CLOSED TEXT SET 違反(余計な文字)の有無 /
   元写真の保持 / アンカー位置の正しさ。
3. **`usage` を記録**してコスト試算を実測値で再実行
   (`--img-in=` `--txt-in=`)。`lib/api-cost-calculator.ts` に
   `gpt-image-2.5-*` の単価を追加する(現状 fallback $0.04 に落ちる)。
4. **Flare で同品質が出るか試す**。出るなら Flare に落としてレイテンシを取る。
5. **段階投入**: viz のみ → 一部トラフィック → 全面。Gemini 経路はロールバック用に残す。

## 5. 未解決・要判断

- 是正再生成(`verifyOrRegenerateImages`)は現状 Gemini 経路のみ。
  GPT Image 2.5 に移す場合、検証ロジック自体はモデル非依存なので有効化できるが、
  再生成率ぶんコストが増える(`--regen` で再試算のこと)。
- Gemini は1リクエストで最大2枚返し UI もそれを使う(`imgs.slice(0, 2)`)。
  GPT Image は `n=1`。viz を移す際は「1枚に減らす」判断が要る。
  減らさず2枚出すならリクエスト2回 = viz のコストは倍。
