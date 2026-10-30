# AR事故・浸水学習 Design QA（2026-10-30）

**Findings**

- [P2 / 検証ブロック] 320×568と768×1024の最終調整後の再撮影が未完了。ローカルブラウザ操作がWork設定で無効になり、再取得できない。現在のルート文書にある過去の地図ピンQAのpassedは、このAR機能の判定ではない。
- [公開前ゲート] Google Mapsの本番・プレビューキーはユーザー回答で未設定。公式画像・権利表示・CSP・実機カメラ復帰は実接続確認が必要。設定不足の画面とAPI正常/失敗のモック検証は済んでいる。

**Visual truth / evidence**

- 選択画像: `docs/design/ar-hazard/selected-inline-water.png`（修正案1、853×1844 pixels）。
- 実装: `docs/design/ar-hazard/implementation-mobile.png`（390×844 pixels）。
- 同一入力に並べた比較: `docs/design/ar-hazard/comparison-mobile.png`（800×874 pixels）。選択画像を390×844へ縮小し、ブラウザクロームを含まない実装スクリーンショットと比較した。
- 初回比較: `docs/design/ar-hazard/comparison-mobile-initial.png`。
- Local URL: `http://localhost:4173/?capture=1`。無視対象のfixtureハーネスで実際のARRealRisks / ARInundationOverlay / AccidentStreetViewを表示した。街路・事故・位置・浸水値はデザイン検証用サンプル。本番の認証は回避していない。
- CSS viewport: 390×844、ブラウザviewport overrideで確認。スクリーンショット出力も390×844、追加の密度変換なし。小型幅は320×568でも確認したが最終修正後の画像が未取得。
- 状態: 洪水・0.5〜3.0mの架空の値、立ち止まり確認後の水位表示。再生/停止は別の状態なので、ボタン文言の差をデザイン誤差として扱わない。津波切替、再再生、景色の全画面表示と設定不足表示も操作した。

**Five fidelity surfaces**

- Fonts/typography: 既存アプリのfont-app / Zen Maru Gothic系のフォールバックを維持。大きな深さ値、種類、注意文、出典の階層は比較画像で確認。実機フォントの最終確認は残る。
- Spacing/layout: 初回は操作列が深さ見出しの下にあり、カメラ表示が狭かった。見出しと停止・再再生を横並びにし、最終390幅の紙面高275pxをDOMで確認。ResizeObserverで水面の底辺を紙面上に追従させた。小型幅は縦並びに切り替え、紙面をスクロールできる。
- Colors/tokens: cream #fffdf7、ink #43392b、洪水cyan #0891b2、津波purple #7e22ce、実事故orange #f4801f。水面は透過し、背景の道路を見通せる。
- Image quality/assets: 生成した透過の水面と比較人物を使用。架空の街路は検証用背景のみ。本番ARはカメラ。参照画像の人物は水深に対して縮尺が合っていないため、実装では1.7m人物と上下端を同じ尺度にし、人物を意図的に小さくした。大きな浸水値では縮尺が圧縮される。
- Copy/content: 実事故と投稿を区別し、出典、対象年、学習イメージの注意文を表示。架空の値はサンプルと明示。上限なし・深さ不明の描画制御はコンポーネントテストで確認。

**Comparison history**

1. 初回: 見出しと操作が縦に重なり、カメラ領域の比率が参照と異なる（P2）。事故マーカーと高さの比較領域も近すぎた。`comparison-mobile-initial.png`。
2. 修正: active紙面をgridで横並びにし、事故マーカーを上へ移動、閉じる操作を種類タブの横へ配置。320幅では操作列を独立させ、折り返しを抑制。最終390幅で再撮影し、`comparison-mobile.png`を同じ入力で比較。主要領域と紙面は改善した。人物寸法の違いは正しい尺度による意図した差。
3. 残り: 小型・タブレットの最終再撮影がブラウザ設定でブロック。未検証をpassedに置き換えない。

**Interaction evidence**

- 浸水の深さを見る → 立ち止まって再生 → 一時停止 → もう一度を操作。
- 洪水/津波切替と津波の避難行動文を確認。
- 景色を見る → 不透明な全画面の設定不足表示を確認。Google画像は未取得。
- 最終確認用の新規タブのconsole error一覧は空だった。開発中のHMRではcreateRoot再実行警告があったため、新規タブで区別した。
- 深さ不明、上限なし、reduced motion、安全抑制、古い応答無視は自動テストで確認。実機センサーの検証ではない。

**Implementation checklist**

- [x] 参照画像とブラウザの実装画像を並べて比較
- [x] 初回P2の紙面・マーカー配置を修正し390幅で再撮影
- [ ] Workのローカルブラウザが利用できる状態で320幅・768幅を再撮影
- [ ] Google専用キー設定後、隔離プレビューで公式画像と実機AR復帰を確認

final result: blocked

---

## 過去の地図マーカーQA（今回のARとは別の履歴）

# Map Hazard Marker Design QA

- Source visual truth: `.codex-artifacts/map-marker-audit-2026-07-17/05-selected-pin-concept.png`
- Implementation screenshot: `.codex-artifacts/map-marker-audit-2026-07-17/08-map-pin-implementation-zoomed.png`
- Full-view comparison: `.codex-artifacts/map-marker-audit-2026-07-17/09-source-implementation-comparison.png`
- Focused marker comparison: `.codex-artifacts/map-marker-audit-2026-07-17/10-marker-focused-comparison.png`
- Viewport: 1920 × 1080
- Route: `/map`
- State: demo user authenticated; cluster expanded once; standard 2D map

## Findings

No actionable P0, P1, or P2 differences remain.

- Marker shape and spacing: individual reports use a 36 × 42 px Lucide `MapPin` with a centered 15 × 15 px category icon. Browser measurements confirmed every category icon is fully contained within its marker.
- Cluster treatment: clusters use two overlapping pin icons and a centered count, matching the selected concept's stacked-pin affordance.
- Fonts and typography: the existing application typography and hierarchy are unchanged. Cluster count uses the existing UI weight and remains legible at map scale.
- Spacing and layout rhythm: header, search, filters, controls, map crop, and bottom actions remain unchanged. Marker anchoring moved to the pin tip so geographic positions remain accurate.
- Colors and visual tokens: danger severity continues to use `getDangerLevelPresentation`; the white keyline and controlled shadow match the selected concept and existing warm UI.
- Image quality and asset fidelity: all marker artwork uses the installed Lucide icon library; no raster placeholders, emoji, handcrafted SVG, or generated production assets were introduced.
- Copy and content: existing application copy is unchanged. Marker accessibility labels now identify the category and action in Japanese.

## Intentional Differences

- The generated concept contains illustrative extra markers and category colors that are not present in live data. The implementation preserves the actual report count and danger-severity colors instead of fabricating records or changing domain semantics.

## Interaction and Runtime Checks

- Individual marker click opens the report detail dialog.
- Enter on a focused marker opens the same dialog.
- Cluster click zooms in and separates the group.
- Marker focus rings and reduced-motion behavior are present.
- Console error and runtime error capture were enabled while opening and closing a report dialog; both remained empty.
- No visible clipping, icon overflow, or application error state was observed.

## Comparison History

### Pass 1

- Earlier findings: none at P0/P1/P2.
- Fixes made after comparison: none required.
- Post-fix evidence: not applicable; the first browser-rendered implementation passed.

## Follow-up Polish

- P3: a future usability study could compare 15 px and 16 px inner icons on lower-density mobile devices. This does not block the current desktop result.

final result: passed

## 2026-09-30 Revision: 「色つきの外形 + 白い丸 + 濃い色の絵」

Supersedes the marker shape, cluster treatment, and asset-fidelity findings above. User feedback after the pass above: the icons inside the map were still hard to understand.

- Root cause: Lucide `MapPin` carries an inner circle (r=3). Drawn with a white stroke it put a white ring directly behind the 15 px category icon, and the white icon had low contrast on the yellow/amber pins.
- Individual reports: 44 × 54 px teardrop from `lib/map/pin-shape.ts` (one handcrafted `<path>`, no inner ring), filled with the danger-level color, with a white disc and a 20 px category icon in ink color. This intentionally reverses the earlier "no handcrafted SVG" finding; category icons are still Lucide.
- Clusters: round count badge (`N件`) in the members' highest danger-level color, so clusters and single pins differ by shape.
- Shapes carry meaning: teardrop = report / circle = cluster / rounded square = route hazard (flood = cyan, tsunami = purple; neither collides with danger-level colors or the green report-location pin).
- Category icons come from `lib/map/danger-type-presentation.ts` for the pin, legend, sidebar, report wizard, detail modal and help dialog. Crime is `Siren` (was `Shield`), disaster is `CloudRainWind` (matches the wizard), other is `CircleAlert` (was `HelpCircle`).
- Text labels (`交通 ★★★☆`) appear under pins from zoom 16 (`PIN_LABEL_MIN_ZOOM`). A pin only gets a label when no other marker is within 110 px horizontally and 84 px vertically (`findPointsWithLabelRoom`), so labels never overlap each other or cover a neighboring pin.
- Legend: desktop shows category icons plus the danger-level color scale; mobile opens the full legend from a "ピンの見方" button.
- Evidence: Playwright (Chrome, 390 × 844 and 1366 × 768) against the dev server with fixture reports, at zoom 15 / 16 / 17 / 18. Not covered by screenshots: route hazard markers (no route with hazard data in the local environment) and satellite styles.

## 今回のAR作業の判定（2026-10-30）

先頭のAR QAが現在の判定。上記の地図ピンQAは別機能の履歴であり、今回のARの完了判定には使わない。小型画面・タブレットの最終再撮影、およびGoogle実接続が残る。

final result: blocked
