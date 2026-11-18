# Instagram Reels 交通事故データ動画シリーズ — Claude Code 引き継ぎ仕様書

## 1. プロジェクト概要と「勝ちパターン」
警察庁の交通事故統計オープンデータ（`honhyo_2023_to-degree.csv`：307,930件）を活用した、Instagram Reels（1080×1920 縦型）向けの**雑学・都市伝説風ランキング解説動画**シリーズです。

* **EP01〜EP20 は制作完了済み**（`artifacts/series-20/output/ep01_..._final.mp4` 〜 `ep20_..._final.mp4`）。
* **実証済みの勝ち型（2本目で1,200再生超えを記録した構成）**:
  1. **テーマ構造**: 「件数最多・安全そうな基準（青バー）」 vs 「実は桁違いに死にやすいワースト3（金・赤バー、〇倍ギャップ）」
  2. **尺とテンポ**: 30〜38秒（ナレーションを `atempo=1.080` で引き締め、前置きを省いて4秒目で本題へ入る）
  3. **画面構成**:
     * 上部HUD：`FILE #XX // タイトル` ＋ カウントアップタイマー
     * 中央：出現済みの順位だけを動的に積み上げるバーグラフ＋注目行スポットライト＋下部に「参考（青バー）」を常時比較表示
     * 演出：第1位・種明かし時の赤フラッシュ＆カメラシェイク、レーダーパルス＆スピードライン
     * 音響：Gemini TTS ナレーション（-14 LUFS）＋ 120BPMサスペンスパルスBGM ＋ インパクト/データ切替SE

---

## 2. 関連ファイル構成

| ファイル / ディレクトリ | 役割 |
| :--- | :--- |
| `honhyo_2023_to-degree.csv` | 警察庁 本票オープンデータ（307,930件、UTF-8） |
| `lib/traffic-accident/npa-codebook.json` | 本票データのコード定義（天候・路面・道路形状・当事者種別など） |
| `artifacts/series-20/episodes.json` | 各エピソードの定義JSON（EP01〜EP20収録済み） |
| `artifacts/series-20/template_winning_v3.html` | 汎用モーショングラフィックス・テンプレート（`initEpisode` / `setProgress`） |
| `artifacts/series-20/batch_render.mjs` | Playwright（Chrome）＋ FFmpeg による自動動画生成＆BGM/SEミキサー |
| `artifacts/series-20/scripts_and_captions.md` | Gemini TTS用原稿 ＆ Instagramキャプション/ハッシュタグ一覧 |
| `artifacts/series-20/audio/` | ユーザーが Gemini TTS で生成した `epXX.wav` の配置場所 |
| `artifacts/series-20/output/` | 完成版 `.mp4` の出力先 |
| `artifacts/reels-weather-01/*.jpg`<br>`artifacts/reels-time-02/*.jpg`<br>`artifacts/reels-place-03/*.jpg` | 既存の9:16文字なし背景画像（13枚）。新規テーマにも流用可能 |

---

## 3. Claude Code での続き（EP21以降）の制作手順

### Step 1: 実データから新ネタを発掘（EP01〜EP20と重複させない）
`honhyo_2023_to-degree.csv` と `lib/traffic-accident/npa-codebook.json` を Node.js スクリプトで集計し、「参考（基準） vs ワースト3」で強い倍率差が出る切り口を抽出します。

**未開拓のおすすめ切り口候補**:
* **都道府県別 致死率ワースト**（東京・大阪・愛知などの件数上位 vs 地方県の高致死率）
* **サポカー有無・エアバッグ有無・認知機能検査経過日数** 別の致死率
* **ゾーン30規制内 vs 規制外**、**一時停止標識あり vs なし**
* **曜日 × 時間帯**（例：土曜深夜 vs 平日朝）、**車種 × 場所**（例：軽自動車のカーブ・単独事故）
* **速度規制別**（30km/h規制 vs 60km/h・規制なし）や **衝突部位別**（正面 vs 側面 vs 追突）

> **注意**: 数値は必ず `honhyo_2023_to-degree.csv`（または他年度CSV）から実測し、推測や丸めすぎによる誤記を避けてください。

### Step 2: `episodes.json` と `scripts_and_captions.md` への追記
1. `artifacts/series-20/episodes.json` の配列末尾に `"id": "21"` 以降を追加します。
   * `narration` は **145〜165文字程度（約33〜36秒）** に収めると完視聴率が高くなります。
   * `bgs` には既存の背景画像パス（`../reels-time-02/scene4_3am.jpg` 等）から雰囲気に合う3枚を指定します（新規画像を用意する場合は `9:16` 文字なしで保存）。
2. `artifacts/series-20/scripts_and_captions.md` に EP21 以降の原稿とキャプションを追記します。

### Step 3: レンダリング実行
* **音声がまだない場合（プレビュー確認）**:
  ```powershell
  node artifacts/series-20/batch_render.mjs --eps 21,22,23
  ```
* **ユーザーが `artifacts/series-20/audio/ep21.wav` 等を配置したあと（本番書き出し）**:
  ```powershell
  node artifacts/series-20/batch_render.mjs --eps 21,22,23
  ```
  ※ `audio/epXX.wav` が存在すれば自動で音声尺に合わせてタイムライン伸縮＋BGM/SEミックス＋`_final.mp4` 書き出しを行います。

---

## 4. 遵守事項
* リポジトリルートの `CLAUDE.md`（`.env` の読み取り・出力禁止、無条件 `rm -rf` 禁止、本番デプロイ制限）を必ず遵守すること。
* `batch_render.mjs` は `playwright` のシステム Chrome（`channel: 'chrome'`）と `ffmpeg` / `ffprobe` を使用します。
