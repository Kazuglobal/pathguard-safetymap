# PathGuardian 動画企画「こどもしてん(115cm)」ストーリーボード

> 作成日: 2026-07-07
> 制作フロー: storyboard-creator → video-prompt-adapter(いずれも `~/.claude/skills/` にインストール済み)
> コンセプト: 通学路の写真1枚 + 近隣の交通事故データ → 子ども目線(115cm)で「見えていない危険」を可視化する短尺動画

## 0. 前提(ヒアリング済み事項)

| 項目 | 内容 |
|---|---|
| 媒体 | SNS(Instagram Reels / TikTok / YouTube Shorts 共通) |
| 総尺 | 24秒 |
| アスペクト比 | 9:16 |
| 主役 | 実在の通学路(写真1枚、匿名化済み)とそこに潜む危険 |
| プロジェクト名 | `pathguardian-kodomo-shiten` |

### 絶対に守る制約(このアプリの安全設計原則との整合)

- 実在の子どもの顔は一切映さない・生成しない。子どもを表す場合はマスコット「ルペ」等のイラスト/シンボル表現に限定し、フォトリアルな人物は生成しない
- 115cm POV・大人の手元・アプリ画面収録は**すべて実写撮影**。AI動画生成はここでは使わない
- AI生成は「見えない危険(事故データ)の可視化」演出パートのみに限定する
- こわがらせる演出(衝突の瞬間・血・悲鳴)は禁止。危険ゾーンの可視化と「どうすればいいか」の提示までに留める(`lib/hunter/accident-context.ts` の `childRiskHint` と同じ北極星)
- 表札・ナンバープレート等、場所や個人を特定できる情報は出さない(`lib/disaster-scenario-prompts.ts` の共通ルールと同一)

---

## 1. スタイルバイブル(このプロジェクト用・新規作成)

実写パートには適用しない(実写はカメラ・照明の現場判断)。**AI生成イラストパートにのみ適用する。**

```yaml
world_concept: "紙のフィールドノートの上に、見えない交通危険がやさしい手描きイラストで浮かび上がる、たんけんノートの世界"
palette:
  primary: "#159E72（森のみどり）"
  accent: "#F4801F（安全オレンジ）"
  forbidden_colors: "彩度の高い警告赤・血の赤は禁止。赤は危険ゾーン表示(#D95555)のみに限定使用"
light_philosophy: "紙面全体を均一に照らすフラットな光。強い陰影・ドラマチックなリムライトは使わない（こわがらせない）"
atmosphere: "紙のざらつき、手描き線のわずかなゆらぎ"
lens_language: "実写パートは子どもの目線高さ(約115cm)固定。イラストパートは平面的な2D構成でレンズ概念を持たない"
grade_reference: "たんけんノート配色（紙#FBF5E9のクリーム地、インク#43392B）。フォトリアルは一切禁止"
motion_grammar: "動きは短く・ゆっくり・方向性が明確。急激なズーム/シェイクは禁止（こわがらせない原則）"
audio_identity: "BGMは控えめ、環境音は最小限。悲鳴・衝突音は絶対に使わない"
global_negative: "no photorealistic human faces, no blood, no screaming, no crash impact moment, no visible license plates, no readable house numbers or signage, no scary lighting, no jump-scare motion"
character_bible:
  - name: "ルペ"
    canonical_ref: "REF-LUPE（要書き出し。下記「制作メモ」参照）"
    invariants: "虫めがねのレンズを顔として持つ丸いキャラクター。頭の上に黄色(#FFC93E)の安全帽。右下に木製の持ち手。頬にベリーピンク(#F2699C)の丸い頬。表情線はインク色(#43392B)。全カットでこの記述を一字一句同じにする"
```

**制作メモ**: `REF-LUPE` は既存の `components/safety-quest/hunter/theme.tsx` の `Mascot` コンポーネントを画面書き出し(スクリーンショット/Storybook)して参照画像化すること。新規にルペを描き起こさない(ブランド一貫性のため)。

---

## 2. 構成(拍の分解)

総尺24秒。SNS短尺の定石(フック→状況→転→解決→CTA)をベースに、「転」を本企画の核として厚めに配分。

| 拍 | 目的 | 配分 |
|---|---|---|
| フック | 同じ場所なのに見え方がこんなに違う、という衝撃 | 2.0s (8%) |
| 状況 | これは実在する、うちの近所かもしれない通学路だと認識させる | 4.0s (17%) |
| 転(発見) | 大人には見えないが、データ上は本当に危険がある、という気づき | 5.0s (21%) |
| 転(行動) | 気づきを「どうすればいいか」の具体策に転換する | 5.0s (21%) |
| 解決 | こわいだけで終わらせず、ルペが寄り添う安心感 | 5.0s (21%) |
| CTA | 自分の家の周りも見てみたいと思わせ、行動を喚起する | 3.0s (13%) |

検算: 2.0+4.0+5.0+5.0+5.0+3.0 = **24.0s** ✓

---

## 3. カット割り(shot list)

| shot_id | beat | 尺 | サイズ | 種別 | 動機 |
|---|---|---|---|---|---|
| KS01_CUT01 | フック | 2.0s | MS→MS(低) | **実写** | リズム(フックの衝撃) |
| KS01_CUT02 | 状況 | 4.0s | MS(child POV) | **実写** | 新情報(死角の提示) |
| KS01_CUT03 | 転(発見) | 5.0s | MS | **AI生成** | 転(発見・驚き) |
| KS01_CUT04 | 転(行動) | 5.0s | MS〜WS | **AI生成** | 新情報(行動指示への接続) |
| KS01_CUT05 | 解決 | 5.0s | MCU | **AI生成**(代替案あり) | リアクション(安心) |
| KS01_CUT06 | CTA | 3.0s | WS/グラフィック | **静止画グラフィック** | CTA |

---

## 4. 絵コンテ本体

### CUT KS01_CUT01｜MS→MS(低)｜2.0s｜**実写**

**言語スケッチ(構図)**
- 前景: なし
- 中景: 見通しの悪い交差点。奥に駐車車両、その奥に車道(主被写体位置: 画面中央奥)
- 背景: 住宅街の塀・生垣
- カメラ高さ/アングル: 大人の目線(約150cm)→一気に子どもの目線(約115cm)へ

**演技・動き**
- (人物は映さない。カメラのみが被写体) → カメラが体感的に「ガクッ」と沈み込む
- ⇒ クラッシュズームダウン(0.3秒で一気に35cm下降)
- 視線/移動方向: 正面固定

**音・テキスト**
- セリフ: none
- 音: ガクッという効果音1つ(衝撃音ではなく「気づき」の軽い音)
- テロップ: 「これが小1の視界です」(1.2s時点でパッと出現、画面上部)

**カットの動機**: リズム(フックの衝撃で指を止めさせる)
**次カット接続**: CUT02は同じ交差点・同じ高さから始まる(視点の連続性)

**撮影メモ(実写)**
- カメラ位置: 交差点の歩道上、進行方向正面
- 画角: 広角〜標準。まず150cm高さで構え、0.3秒かけて胸の高さ(115cm)まで一気に下げる(手ブレは可・むしろ効果音と合わせて「体感」を出す)
- 小道具: 実際に駐車されている車1台以上が画面奥の車道を隠している状態が理想(死角の説得力に直結)
- 匿名化: 通行人・ナンバープレートが映り込んだ場合は撮影後にモザイク処理必須(`lib/hunter/masking.ts` の顔ぼかしロジックと同等の基準)

---

### CUT KS01_CUT02｜MS(child POV)｜4.0s｜**実写**

**言語スケッチ(構図)**
- 前景: 駐車車両の側面(画面右寄り、死角を作る)
- 中景: 交差点の車道(主被写体位置: 画面中央。駐車車両の陰でほぼ隠れている)
- 背景: 奥の道路へ続く見通し
- カメラ高さ/アングル: 子どもの目線(約115cm)固定

**演技・動き**
- (人物は映さない) → カメラがゆっくり2歩分前進
- ⇒ ゆっくりとしたハンドヘルド・トラッキング(POV)
- 視線/移動方向: 正面奥へ直進

**音・テキスト**
- セリフ: none
- 音: 環境音(遠い車の音、風、自分の足音)のみ
- テロップ: none(次カットのフックのために画面をクリーンに保つ)

**カットの動機**: 新情報(この高さでは死角があるという事実の提示)
**次カット接続**: CUT03は同じ構図・同じ静止フレームから始まる(実写→イラストへの切り替わり)

**撮影メモ(実写)**
- カメラ位置: CUT01と同じ交差点、115cm固定高でのPOV歩行
- 画角: CUT01のラスト構図を引き継ぐ(同ポジションから2歩分前進)
- 小道具: CUT01と同じ駐車車両。歩行速度は「子どもの自然な歩調」を意識しゆっくりめに
- 撮影後、この最終フレーム(静止画切り出し)を CUT03 の開始フレーム参照として使う

---

### CUT KS01_CUT03｜MS｜5.0s｜**AI生成**

**言語スケッチ(構図)**
- 前景: 駐車車両の陰(画面右)
- 中景: その陰から、車のシルエットイラストが紙ににじむように現れる(主被写体位置: 画面中央やや右)
- 背景: CUT02と同一の実写背景を維持(改変しない)
- カメラ高さ/アングル: 固定(2Dイラストのためカメラ移動なし)

**演技・動き**
- 車のシルエット(顔・運転者なし、車体のみのフラットなイラスト) → 死角から静かに滲み出るように出現
- ⇒ 固定(2Dオーバーレイ)
- 視線/移動方向: 中央やや右へ集約

**音・テキスト**
- セリフ: none
- 音: 静かな低音1音(気づきの合図。衝突音・警告音ではない)。環境音はCUT02から継続
- テロップ: 「ここ、見えていますか?」(2s時点でフェードイン、画面下部中央)

**カットの動機**: 転(発見・驚き。ただしこわがらせない)
**次カット接続**: この最終フレーム(シルエット確定後の静止)をCUT04の開始フレームとする

**パネル画像生成プロンプト(絵コンテ用・英語)**
```
Storyboard panel, rough pencil sketch, monochrome line art with light
gray shading, clean composition, cinematic framing, no color, no text,
no watermark. Medium shot of a real photographed street corner at
child's eye level, with a flat car silhouette (no driver, no face)
softly emerging from the blind spot behind a parked car on the right
side of the frame. Foreground: side of a parked car on the right.
Midground: the emerging silhouette, centered slightly right. Background:
unchanged street corner receding into the distance. Fixed camera, no
movement (2D overlay). Aspect ratio 9:16.
```
ファイル名: `pathguardian-kodomo-shiten_KS01_CUT03_panel.png`

**受け渡しブロック(video-prompt-adapter へ)**
```yaml
# --- handoff: KS01_CUT03 ---
meta: { shot_id: "KS01_CUT03", project: "pathguardian-kodomo-shiten" }
subject:
  who_what: "見通しの悪い交差点の死角に潜む、車のシルエット(顔・運転者なし、車体のみのフラットなイラスト)"
  state_emotion: "静かな緊張感。まだ気づかれていない危うさ（こわがらせない）"
action:
  movement: "実写の死角部分から、紙にインクがにじむように車のシルエットが静かに浮かび上がる"
  speed_quality: "ゆっくり、じわりと"
camera:
  shot_size: "MS"
  camera_move: "fixed（2Dイラストのためカメラ移動なし）"
  lens_fov: "─（2Dのためレンズ概念なし）"
  dof: "─"
lighting:
  source_direction: "紙面全体への均一なフラット光"
  quality: "柔らかい・陰影を強調しない"
  time_of_day: "日中（実写ベースを継承）"
color_grade: "たんけんノート配色（紙#FBF5E9・インク#43392B）の上に、シルエットのみグレー〜インク色で描く"
texture_atmosphere: "紙のざらつき、手描き線のわずかなゆらぎ"
mood: "気づきの静かな驚き"
duration_sec: 5
aspect_ratio: "9:16"
time_structure: "0-1s実写のまま静止 → 1-4sシルエットがにじむように現れる → 4-5s輪郭が定まり静止"
audio: { dialogue: "none", music: "静かな低音の一音（気づきの合図）", ambience: "遠い環境音を継続" }
text_overlay:
  content: "ここ、見えていますか?"
  timing: "2秒時点でフェードイン"
  position: "画面下部中央"
  appearance: "ふわっとフェードイン"
  style: "Zen Maru Gothic系の丸ゴシック、インク色(#43392B)、白フチ"
references:
  - { id: "REF-A", type: "image", role: "storyboard構図", note: "KS01_CUT03パネル" }
  - { id: "REF-B", type: "image", role: "開始フレーム", note: "CUT02実写ラストフレーム" }
negative: "─（global_negative継承）"
continuity_note: "CUT02の実写ラストフレームと同一構図から開始。この最終フレームをCUT04冒頭に引き継ぐ"
```

**Seedance 2.0 変換**(REF-B→Image 1 / REF-A→Image 2)
```
A flat, hand-drawn illustration of a car's silhouette quietly bleeds
into view like spreading ink, emerging from the blind spot behind a
parked car at a narrow street corner, its shape still soft and just
barely taking form, with no driver and no face, a subtle uneasy quiet
building as it becomes visible. Flat, even paper-textured lighting
with no harsh shadows, matching a warm cream-paper illustration style
(paper #FBF5E9, ink line #43392B), with gentle grain and a faint
wobble in the hand-drawn line. Fixed medium shot, no camera movement —
this is a flat 2D illustration overlay, not a live-action shot.
Start from Image 1. Follow the storyboard composition from Image 2.
Over 5 seconds: for the first second the frame stays as the real
photo, then over the next three seconds the car silhouette gradually
bleeds into view like ink spreading on paper, and in the final second
its outline settles and holds still.
Audio: a single soft low tone marking the moment of realization,
ambient street sound continuing quietly underneath, no music swell.
The text "ここ、見えていますか?" fades in at 2 seconds, at the bottom
center, in a soft rounded Zen Maru Gothic typeface in ink color
(#43392B) with a white outline.
No photorealistic human faces. No blood. No screaming. No crash
impact moment. No visible license plates. No readable house numbers
or signage. No scary lighting. No jump-scare motion.
```
※ 尺5秒・9:16はパラメータ側で指定

**Omni Flash 変換**(REF-B→`<FIRST_FRAME>` / REF-Aは言語化して消化)
```
<FIRST_FRAME>

Single continuous shot, no scene cuts. A real photograph of a narrow
residential street corner holds still as the opening frame. Over the
following seconds, a flat, hand-drawn illustration of a car's
silhouette begins to bleed into the blind spot behind a parked car,
like ink slowly spreading across paper — soft-edged at first, with no
driver, no face, and no visible license plate, just the quiet shape of
a vehicle gradually taking form. [0-1s] the frame remains the
untouched real photograph; [1-4s] the car silhouette bleeds into view,
gaining shape and quiet weight; [4-5s] its outline settles and holds
still, a subtle uneasy stillness in the air. Fixed medium shot, no
camera movement, as this is a flat two-dimensional illustration
overlay rather than a live-action camera move. The lighting is flat
and even across the paper-toned surface, matching a warm cream-paper
illustration style with ink-brown linework, softly grained, with a
faint hand-drawn wobble in the lines — no harsh shadows, no dramatic
rim light. The mood is a quiet, sober moment of realization, not fear.
No music, only the continuing quiet ambient street sound carried over
from the previous shot — no swelling score. No dialogue. The words
"ここ、見えていますか?" fade in at the two-second mark, centered near
the bottom of the frame, in a soft rounded Zen Maru Gothic typeface in
ink brown (#43392B) with a thin white outline. Do not depict any
photorealistic human face. Do not show blood, screaming, or a crash
impact moment. Do not show a visible license plate, readable house
number, or any signage. Do not use scary lighting or a sudden
jump-scare camera motion. Aspect ratio 9:16, 5 seconds.
```

---

### CUT KS01_CUT04｜MS〜WS｜5.0s｜**AI生成**

**言語スケッチ(構図)**
- 前景: なし
- 中景: CUT03のシルエット周辺に、危険ゾーンのレイヤーが順に重ね描きされる(主被写体位置: 画面全体に拡張)
- 背景: 同一構図を維持
- カメラ高さ/アングル: 固定からごくわずかにpush-out(全体を見せるため)

**演技・動き**
- 赤い斜線ゾーン(死角付近)→黄色いドットゾーン(交差点手前)→緑の太い矢印(安全な迂回路) → この順で描き足される
- ⇒ ごくわずかなpush-out
- 視線/移動方向: 赤→黄→緑の順に視線誘導

**音・テキスト**
- セリフ: none
- 音: BGMがここでわずかに前向きなトーンへ転調。環境音は継続
- テロップ: 「赤=近づかない」「黄=気をつける」「緑=にげる道」の凡例ラベルを各ゾーン脇に小さく表示

**カットの動機**: 新情報(気づきを具体的な行動指示に変換する)
**次カット接続**: 画面右下にルペが入るスペースを空けたまま静止し、CUT05でそこにルペが登場する

**パネル画像生成プロンプト(絵コンテ用・英語)**
```
Storyboard panel, rough pencil sketch, monochrome line art with light
gray shading, clean composition, cinematic framing, no color, no text,
no watermark. Wide-medium shot of the same street corner illustration,
now overlaid with three zone markers: diagonal hatching near the blind
spot on the right, dotted marks in front of the intersection at
center, and a bold arrow curving toward a safer detour on the left.
Empty space reserved in the lower right for a mascot character to
enter in the next panel. Fixed camera with a very slight push-out.
Aspect ratio 9:16.
```
ファイル名: `pathguardian-kodomo-shiten_KS01_CUT04_panel.png`

**受け渡しブロック(video-prompt-adapter へ)**
```yaml
# --- handoff: KS01_CUT04 ---
meta: { shot_id: "KS01_CUT04", project: "pathguardian-kodomo-shiten" }
subject:
  who_what: "CUT03のシルエットを起点に重ね描きされる危険ゾーン(赤=近づかない/黄=注意/緑=にげる道)"
  state_emotion: "気づきから安心への切り替え"
action:
  movement: "赤い斜線ゾーンが死角付近に、次に黄色いドットゾーンが交差点手前に、最後に緑の太い矢印が安全な迂回路に、順に描き足される"
  speed_quality: "順番に・落ち着いたテンポで"
camera:
  shot_size: "MS〜WS"
  camera_move: "ごくわずかなpush-out"
  lens_fov: "─"
  dof: "─"
lighting: { source_direction: "─（バイブル継承）", quality: "─", time_of_day: "─" }
color_grade: "赤(#D95555)/黄(#FFC93E)/緑(#159E72)。彩度の高い警告赤は使わず、たんけんノートの配色内に収める"
texture_atmosphere: "─（バイブル継承）"
mood: "こわさから、具体的な行動への転換"
duration_sec: 5
aspect_ratio: "9:16"
time_structure: "0-1.5s赤ゾーン出現 → 1.5-3s黄ゾーン出現 → 3-4.5s緑の矢印が描かれる → 4.5-5s全体を見せて静止"
audio: { dialogue: "none", music: "わずかに前向きなトーンへ転調", ambience: "継続" }
text_overlay:
  content: "赤=近づかない／黄=気をつける／緑=にげる道"
  timing: "各ゾーン出現と同時に、小さく表示"
  position: "各ゾーンの脇"
  appearance: "出現と同時にフェードイン"
  style: "Zen Maru Gothic、インク色、白フチ、控えめなサイズ"
references:
  - { id: "REF-A", type: "image", role: "storyboard構図", note: "KS01_CUT04パネル" }
  - { id: "REF-B", type: "image", role: "開始フレーム", note: "CUT03最終フレーム" }
negative: "─（global_negative継承）"
continuity_note: "CUT03の最終フレームから直接続く。画面右下にルペ登場用の空間を残す"
```

**Seedance 2.0 変換**(REF-B→Image 1 / REF-A→Image 2)
```
Danger zone markers illustrate themselves onto the same street corner
illustration in sequence: first, red diagonal hatching spreads over
the blind spot area on the right; then, yellow dotted marks appear
just in front of the intersection at center; finally, a bold green
arrow draws itself curving toward a safer detour path on the left.
Flat, even paper-textured lighting, warm cream-paper illustration
style with ink-brown linework, colors kept within a soft storybook
palette — red (#D95555), yellow (#FFC93E), green (#159E72) — no harsh
saturated warning red. Wide-medium shot, a very slight push-out to
reveal the full layout. Start from Image 1. Follow the storyboard
composition from Image 2. Over 5 seconds: [0-1.5s] the red hatching
appears; [1.5-3s] the yellow dots appear; [3-4.5s] the green arrow
draws itself in; [4.5-5s] the full composition holds still, with open
space reserved in the lower right.
Audio: the background tone shifts slightly toward a warmer, more
hopeful register, ambient street sound continuing underneath.
Small labels "赤=近づかない" "黄=気をつける" "緑=にげる道" fade in
beside each zone as it appears, in a soft rounded Zen Maru Gothic
typeface in ink color (#43392B) with a white outline, kept small.
No photorealistic human faces. No blood. No screaming. No crash
impact moment. No scary lighting. No jump-scare motion.
```

**Omni Flash 変換**(REF-B→`<FIRST_FRAME>` / REF-Aは言語化)
```
<FIRST_FRAME>

Single continuous shot, no scene cuts. Starting from the illustrated
street corner with the car silhouette in the blind spot, danger zone
markers begin to draw themselves onto the scene in a calm sequence.
[0-1.5s] red diagonal hatching spreads softly over the blind spot area
on the right, marking it as a place to stay away from; [1.5-3s] yellow
dotted marks appear just in front of the intersection at the center,
marking a place for caution; [3-4.5s] a bold green arrow draws itself,
curving toward a safer detour path on the left, marking the way to go;
[4.5-5s] the full illustrated composition holds still, with open,
empty space kept in the lower right of the frame for a character to
enter next. The camera is fixed with only a very slight push-out to
reveal the whole layout, since this is a flat two-dimensional
illustration rather than a live-action shot. Lighting stays flat and
even across the paper-toned surface, in the same warm cream-paper
illustration style with ink-brown linework as before, with colors kept
within a soft storybook palette — a muted red, a warm yellow, and a
forest green — never a harsh saturated warning red. The mood shifts
from quiet unease into calm, practical reassurance. The background
tone warms slightly and becomes more hopeful, with the ambient street
sound continuing quietly underneath — no dialogue. Small labels
reading "赤=近づかない", "黄=気をつける", and "緑=にげる道" fade in
beside each zone exactly as it appears, in a soft rounded Zen Maru
Gothic typeface in ink brown with a thin white outline, kept
small and unobtrusive. Do not depict any photorealistic human face.
Do not show blood, screaming, or a crash impact moment. Do not use
scary lighting or a sudden jump-scare camera motion. Aspect ratio
9:16, 5 seconds.
```

---

### CUT KS01_CUT05｜MCU｜5.0s｜**AI生成(代替案あり、下記参照)**

**言語スケッチ(構図)**
- 前景: なし
- 中景: ルペが画面右下からふわっと登場し、CUT04のゾーン図を指し示す(主被写体位置: 画面右下→中央寄り)
- 背景: CUT04の危険ゾーン図をそのまま維持
- カメラ高さ/アングル: 固定

**演技・動き**
- ルペ → 右下からふわっと浮かび上がるように登場し、ゾーン図を指し示しながら一言アドバイス
- ⇒ 固定
- 視線/移動方向: 画面中央へ向く

**音・テキスト**
- セリフ: 「ここは 車が おおいみたい。止まって 左右を 見る れんしゅうを しよう。」(`lib/hunter/accident-context.ts` の `childRiskHint` と同じトーン・同じ非断定の言い回し)
- 音: あたたかい短いフレーズのBGM
- テロップ: セリフを字幕として同時表示(アクセシビリティ)

**カットの動機**: リアクション(こわさから安心への着地)
**次カット接続**: CUT06のCTAカードへ、ルペの表情を保ったまま緩やかにフェード

**パネル画像生成プロンプト(絵コンテ用・英語)**
```
Storyboard panel, rough pencil sketch, monochrome line art with light
gray shading, clean composition, cinematic framing, no color, no text,
no watermark. Medium close-up of a round mascot character whose face
is a magnifying glass lens, wearing a small safety helmet on top, with
a wooden handle at the lower right, floating gently up from the lower
right corner of the frame and pointing toward the danger zone diagram
behind it. Background: the same street corner illustration with
red/yellow/green zone markers, held static. Fixed camera. Aspect ratio
9:16.
```
ファイル名: `pathguardian-kodomo-shiten_KS01_CUT05_panel.png`

**受け渡しブロック(video-prompt-adapter へ)**
```yaml
# --- handoff: KS01_CUT05 ---
meta: { shot_id: "KS01_CUT05", project: "pathguardian-kodomo-shiten" }
subject:
  who_what: "マスコットのルペ（REF-LUPE。虫めがねのレンズが顔、頭上に黄色い安全帽#FFC93E、右下に木の持ち手、頬にベリーピンク#F2699Cの丸）"
  state_emotion: "やさしく寄り添う、こわがらせない口調"
action:
  movement: "画面右下からふわっと浮かび上がるように登場し、背後のゾーン図を指し示しながら話す"
  speed_quality: "ふわふわと軽やかに"
camera: { shot_size: "MCU", camera_move: "fixed", lens_fov: "─", dof: "─" }
lighting: { source_direction: "─（バイブル継承）", quality: "─", time_of_day: "─" }
color_grade: "─（バイブル継承）"
texture_atmosphere: "─（バイブル継承）"
mood: "安心・励まし"
duration_sec: 5
aspect_ratio: "9:16"
time_structure: "0-1s画面外から浮かび上がる → 1-4sゾーン図を指し示しながら話す → 4-5s微笑んで静止"
audio:
  dialogue: "「ここは 車が おおいみたい。止まって 左右を 見る れんしゅうを しよう。」"
  music: "あたたかい短いフレーズ"
  ambience: "─"
text_overlay:
  content: "（セリフと同一の字幕）"
  timing: "セリフと同期"
  position: "画面下部"
  appearance: "セリフに合わせてフェードイン"
  style: "Zen Maru Gothic、インク色、白フチ"
references:
  - { id: "REF-LUPE", type: "image", role: "キャラ同一性", note: "既存Mascotコンポーネントからの書き出し画像（要準備）" }
  - { id: "REF-A", type: "image", role: "開始フレーム", note: "CUT04最終フレーム" }
negative: "─（global_negative継承）"
continuity_note: "CUT04の背景をそのまま維持。CUT06へゆるやかにフェード"
```

**制作上の代替案(コスト・ブランド一貫性の観点で推奨)**

ルペは**既に実装済みの2D Reactコンポーネント**(`components/safety-quest/hunter/theme.tsx` の `Mascot`)であり、AI動画生成で毎回描き起こすよりも、**既存コンポーネントをそのままアニメーションさせて画面収録する方が安く・速く・ブランドとの誤差もゼロ**になる可能性が高いです。具体的には、Framer Motion(既にこのコンポーネントが依存している)でフェードイン+浮遊アニメーションを付けて画面収録するだけで同じカットが作れます。AI生成はここでは必須ではなく、「AI動画生成のワークフローを揃えるため」の選択肢として併記しています。実制作では**この代替案を第一候補として検討してください**。

---

### CUT KS01_CUT06｜WS/グラフィック｜3.0s｜**静止画グラフィック(AI動画生成不要)**

**言語スケッチ(構図)**
- PathGuardianロゴ+キャッチコピー「写真から安全をつくる」+ルペの静止イラスト+「自分の家の周りも見てみる→プロフィールのリンクへ」のCTAテキスト

**演技・動き**
- テキストがフェードイン、ルペが小さく手を振るループアニメーション(任意)

**音・テキスト**
- 音: BGMの終止
- テロップ: 「あなたの家の周りは、どうですか?」+ CTA

**カットの動機**: CTA
**次カット接続**: なし(最終カット)

**制作メモ**
- Canva/Figma等で静止画カードとして作成し、CSSまたはAfter Effects程度の軽いモーション(フェードイン・微小な浮遊)を付ける。AI動画生成のパイプラインに乗せる必要はない

---

## 5. 総括:キャラクター風 vs リアルの最終判断

このストーリーボードで、当初の問い(キャラクター風かリアルか)は「二択」ではなく**役割分担**として解決した。

| パート | 表現 | 理由 |
|---|---|---|
| カメラ高さ・POV・アプリ画面 | **実写** | 本物であることが信頼性の源泉。AI生成する意味がない |
| 見えない危険(事故データ)の可視化 | **イラスト/モーショングラフィック(ルペのブランド世界観)** | `disaster-scenario-prompts.ts` の「人物・建物を捏造しない」原則を守りながら危険を伝えられる唯一の手段 |
| 実在の子ども | **一切登場させない** | 顔の匿名化ルールを、そもそも子どもを描かないことで無条件に満たす |

---

## 6. 次のアクション

1. `REF-LUPE` の書き出し(`Mascot` コンポーネントのスクリーンショット/SVGエクスポート)
2. CUT01/CUT02の実写撮影(撮影メモの通り)
3. CUT02の最終フレーム静止画切り出し → CUT03の開始フレーム参照として準備
4. CUT03〜CUT05のプロンプトをSeedance 2.0 または Omni Flash に投入し生成、生成結果をこのファイルに追記
5. 生成物が `global_negative` の禁止事項(フォトリアルな人物・血・悲鳴・衝突瞬間等)に抵触していないか、投稿前に必ず目視確認

## 7. 実生成テスト記録(2026-07-07)

実在の通学路写真(見通しの悪いカーブ、ユーザー提供)を開始フレームとして、Gemini Omni Flash (`gemini-omni-flash-preview`) で実際にCUT03相当の5秒プロトタイプを生成した。

**入力**: 実写真1枚(自転車の通行人が写り込んでいたため、生成前にGaussianBlurで匿名化処理を実施)
**プロンプト設計の変更点**: この写真には元のストーリーボード(駐車車両の死角)ではなく「見通しの悪いカーブ」が写っていたため、実際の写真内容に合わせて危険描写を修正。また、この地点の実際の事故統計データは無いため、具体的な件数・断定的な危険表現は使わず「この先、カーブで見えにくいよ」という視覚的事実のみを伝える文言にした(`lib/hunter/accident-context.ts` のデータなし時のフォールバック方針と同じ考え方)。

**結果**: 成功。禁止事項(フォトリアルな人物・血・悲鳴・衝突・捏造統計)への抵触なし。最終1.5秒でクリーム紙×インク線のオーバーレイ(点線の経路・注意アイコン・ふりがな付きキャプション)が「たんけんノート」の世界観に近い形で生成された。

**判明した改善点(次回プロンプト調整)**:
- 「カメラが子どもの目線まで下がる」動きは静止画1枚基準の生成ではほぼ再現されず、画角はほぼ元写真のまま推移した → 高さの変化を狙うカットは実写撮影(CUT01/02設計通り)に任せ、AI生成は据え置きの構図に限定する方が安定する
- 遷移途中(2.5秒付近)に意図しない「スマホ/車窓のフレーム」のような演出が一時的に混入 → プロンプトの `single continuous shot` 指定を強め、フレーム内フレームを明示的に禁止する一文を追加すると改善見込み
- 注意アイコン脇に判読不能な文字ラベルが生成された(既知のAI動画生成の弱点) → 「指定した1つのキャプション以外のテキストを一切生成しない」旨をnegativeに明記して再生成が必要

**再現コマンド**: `python scripts/video/generate_video.py <prompt> --image <blurred_photo> --aspect-ratio 9:16 --duration 5 --output cut03_prototype.mp4`(`~/.claude/skills/gemini-omni-flash-api/` に導入済み。APIキーは `.env.local` の `GEMINI_API_KEY` を使用)

## 8. 重大な問題の発見と方針転換(2026-07-07 追記)

上記§7の生成物を目視確認したところ、**道路のカーブ形状・建物・標識・路面標示が元の写真から作り替えられていた**ことが判明した(道が90度近く曲がって見える・存在しない黄色いダイヤ路面標示が出現・電柱の配置が変わる・判読不能な看板文字が生成される、等)。これは `disaster-scenario-prompts.ts` の絶対ルール「写真の構図/比率/色/被写体を変えない。新しい建物・標識・人・車・設備は生成しない」への明確な違反であり、ユーザーからも直接指摘を受けた。

**根本原因**: Gemini Omni Flash(および動画拡散モデル全般)は「開始フレーム」画像を厳密なピクセル固定として扱わない。5秒間・120フレームすべてを毎回再生成するため、プロンプトでどれだけ「元の写真を変えるな」と指示しても、環境そのものが徐々に作り替えられていく。**「実写真+AIによるオーバーレイ動画生成」という当初のアプローチ自体が、この安全要件と技術的に両立しない。**

**方針転換**: AIによる動画生成をCUT03/04の環境描画に使うのをやめ、**実写真のピクセルをコード側で完全に固定(クロップ・リサイズのみ、再生成なし)し、点線・注意アイコン・キャプションだけをPillow/OpenCVでプログラム的に描画してmp4合成する**方式に変更した。点線の経路は写真に実在する縁石ラインを目視トレースした座標を使用し、新しい道路形状を発明していない。

**結果**: `cut03_overlay_only.mp4` として再生成。道路・建物・電柱・標識のピクセルは元写真から一切変更なし(座標変換=中央クロップして9:16化+リサイズのみ)。ゆえに「存在しない道路の生成」は構造的に発生しえない。

**この方針転換の適用範囲**: CUT04(危険ゾーンのオーバーレイ)も同じ問題を抱えるため、同様にコード側の合成方式へ変更する。CUT05(ルペ)はもともと実写真の上に合成する要件がなく、独立したキャラクターアニメーションのため、AI生成 or 代替案(既存Reactコンポーネントの画面収録)のいずれでも上記の問題は生じない。

## 9. エンタメ性(フック)の強化(2026-07-07 追記)

§8の合成版はユーザーから「エンタメ要素がなくスワイプされそう」という指摘を受けた。最初の1〜2秒に画面を止める力がなく、点線がゆっくり描かれるのを待つだけの「説明動画」になっていたのが原因。

**追加した演出(いずれも実写真のピクセル再生成は一切含まない)**:
- 冒頭0〜1.0s: フックテキスト「しゃがんで 見てみると...」を素早くポップイン
- 0.6〜2.2s: 実写真の中でのクロップ位置移動(Ken Burns的なズーム)で「しゃがむ」動きを表現。同じ実ピクセルの一部を拡大表示するだけで、新しい被写体・構図は生成していない
- 2.5s: 軽い「パンチズーム」(瞬間的な+5%拡大)で気づきの瞬間にアクセント
- 2.5〜2.9s: 点線を高速リビール(v2の2秒がかりの低速描画から0.4秒に圧縮)
- 2.9〜3.3s: 注意アイコンをオーバーシュート付きのバウンスで登場
- 3.3s〜: キャプション表示、保持

**成果物**: `cut03_overlay_punchy.mp4`(`build_overlay_video_v3.py`)。§8の静的な合成版(`cut03_overlay_only.mp4` / v2)より明確にテンポが上がり、短尺SNSのフック定石(0-2秒に最強の画を置く。`storyboard-creator` の `references/shot-grammar.md` 短尺動画の定石表と同じ考え方)に沿う構成になった。

**保存先(プロジェクト内・恒久)**: `docs/video-assets/kodomo-shiten/`
- `cut03_overlay_punchy.mp4` — 最新版(採用candidate)
- `cut03_overlay_only_v2.mp4` — フック演出追加前(参考)
- `cut03_ai_regeneration_FAILED_example.mp4` — §7で発覚したNG例(道路を作り替えてしまった失敗版。**再利用しないこと**。「AIに実写真+オーバーレイをまとめて動画生成させると環境が作り替えられる」という失敗を再発させないための記録として保持)
- `source_photo_blurred.jpg` — 匿名化済みの入力元写真
- `build_overlay_video_v3.py` — 生成スクリプト(再実行・調整のベース)

まだgit管理には追加していない(コミットは別途指示があるまで行わない)。
