# ローカル Claude Code への引き継ぎ（2026-11-18 時点）

クラウドのセッションでここまで進めた。続きはローカル（CSV がある PC）で行う。

## 1. まず読むもの（この順）
1. `CLAUDE.md`（.env の値を出さない、`rm -rf` をいきなり打たない、本番デプロイしない）
2. `artifacts/series-20/PROMPT_EP21-30_THREEJS.md` ← **実行の指示書。これに従う**
3. `artifacts/series-20/HANDOFF_CLAUDE_CODE.md`（シリーズの構成と既存パイプライン）
4. `artifacts/series-20/episodes.json`（EP01〜20。使用済みの軸の一覧は指示書 §2-3）
5. 突出分析 `kiken-hunter-breakout-analysis-20261118.md`（ユーザーの手元にある。指示書 §1 に要点を反映済み）

## 2. 終わっていること
- 指示書（分析 → 制作ルール。HANDOFF と突出分析の食い違いの扱いも決めてある）
- Three.js 縦動画テンプレート `artifacts/series-20/threejs/`（`index.html` / `scene.js` / `render.mjs`）
  - EP01・04・20 の静止画、EP04 の mp4（1080×1920・30fps・36秒・H.264）で確認済み
  - episodes.json の1件で1本。数字は JSON からだけ読む

## 3. 終わっていないこと（ここから）
1. **定義の確認**: `honhyo_2023_to-degree.csv` を Node.js で読み、致死率（死亡事故件数÷人身事故件数）で
   **EP01 の車同士 0.36%・車両単独 5.78%、EP20 の全体平均 0.85%** を再現する。合わなければ止めてユーザーに報告。
   見出しに置換文字（文字化け）があれば、列の位置を推測せず、警察庁の原本・定義書と照合する。
2. **発掘**: 指示書 §2 の採用条件で候補を集計 → `artifacts/series-20/mining/ep21-30_candidates.csv` → **ユーザーに見せて10本を確定**（勝手に決めない）。
   速度規制・衝突部位・エアバッグ・サポカー等を使うなら、警察庁のコード表原本（codebook_2023）でコードを確かめる。`npa-codebook.json` には入っていない。
3. **追記**: episodes.json（id "21"〜"30"、既存の項目だけ）と scripts_and_captions.md（既存の見出しの形）。指示書 §3。
4. **書き出し**: Three.js 版で EP21〜30 を書き出し、静止画で確認。
5. **未決の確認**: キャプションを短く（1〜2行・タグ1〜2個・保存依頼なし）する方針は、ユーザーの最終確認がまだ。追記の前に聞く。

## 4. ローカルでの動かし方（PowerShell）
```powershell
git fetch origin claude/determined-dirac-nlpgjg
git checkout claude/determined-dirac-nlpgjg
pnpm install            # three と playwright は package.json の既存依存
# 確認用の静止画（out/epXX_stills/）
node artifacts/series-20/threejs/render.mjs --eps 01 --stills
# mp4（audio/epXX.wav があれば音声つき _final、なければ _preview）
node artifacts/series-20/threejs/render.mjs --eps 21,22,23
# ブラウザで動きを見る: 上の書き出しと同じサーバーは無いので、series-20 をルートに静的サーバーを立て、
# /three/ を node_modules/three/build に向ける必要がある（render.mjs の server 部分を参照）
```
- システムの Chrome（`channel: 'chrome'`）を先に使い、無ければ Playwright の Chromium。`--bundled` で後者を強制。
- WebGL はソフトウェア描画（swiftshader）で固定している。書き出しは1本36秒で約4分（クラウドでの実測）。
- 書き出し先 `threejs/out/` は git に入れない（.gitignore 済み）。CSV・mp4・フレーム画像もコミットしない。

## 5. 作業ブランチ
`claude/determined-dirac-nlpgjg`。ここにコミットして push。main への PR はユーザーに言われてから。
