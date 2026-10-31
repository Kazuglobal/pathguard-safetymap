# AR実事故・浸水学習・ストリートビュー

## 利用する画面

- 地図の事故レイヤーを表示し、事故の丸を押すと「現地の景色を見る」が出る。Google 地図とストリートビューを不透明な全画面に並べ、閉じると元の地図の位置と吹き出しへ戻る。
- 地図の「タップして事故を調べる」には、同じ中心点の洪水・津波の想定を表示する。「地図で選んだ地点」と「現在地」を区別する。
- ARの「実事故・浸水」で、実事故の方向・距離と公的な浸水想定を確認できる。「投稿の学習」へ切り替えると既存の親子学習を使える。実事故は学習ツアー・クイズに混ぜない。
- 区域内の判定が続いた地点で「深さを見る」から開き、安全な場所で立ち止まったことを確認してから再生する。自動再生しない。洪水は水位の上昇、津波は深さの強調と避難行動を示す。到達する波は描かない。

## データと表示上の限界

初期収録は、洪水の1次メッシュ6140（2025年度、想定最大規模）と、青森県の津波2021年度版。区域141,127件、収録範囲4,825件を既存D1へ追加した。2026-10-30に、大船渡向けとして洪水の1次メッシュ5841と岩手県の津波2022年度版を追加した（区域288,471件、収録範囲7,439件、#276）。大船渡市中心部の盛川沿いには洪水区域がなく、洪水は未収録と表示される。全国対応を意味しない。区域検索のrows_readは東の地点ほど増える（大船渡の津波で約16万行）。索引の改善は #277 で扱う。出典・チェックサム・件数照合は [pilot-receipts.json](../data/ar-hazard/pilot-receipts.json) に保存する。

収録範囲には正確な浸水ポリゴンの外形を使う。調査範囲が未確定の外側は「未収録」であり、「想定区域外」や安全とは判定しない。将来、調査範囲が確認できたデータを登録した場合は区域外を表示できる。取得不能も別表示にする。

人物は高さ約170cmで、深さの上下端と同じ縮尺を使う。深さ不明は文字のみ、上限のない区分は「以上」「上限なし」と表示する。カメラの道路・建物と正確に3D位置合わせする機能ではない。精度50m超・速度15km/h超では浸水学習を抑制する。速度を取れない端末でも手動開始が必要。

既存のルート検索では、初期データの同じ出典・深さに含まれる別々の区域を落とさないため、ポリゴン単位でマーカーを保持する。細分化された隣接区域でマーカーが重複する場合がある。候補上限に達した場合は既存のtruncatedを維持する。

## 地図の景色: 無料の Maps Embed API

`/map` の個別事故の入口は Maps Embed API のみを呼ぶ。PCは左右、スマホは上下にGoogle地図とストリートビューを並べる。景色の中を移動しても事故地点のピンは固定。撮影年月・撮影位置との正確な距離はアプリ独自では取得しない。画像なし・認証エラーはGoogleの枠内に表示されるため、iframeのloadを成功判定に使わない。両枠の再読み込みは画面のボタンから行える。

1. Google Cloudで請求先を確認したプロジェクトのMaps Embed APIを有効にする。利用料は現行の料金では無料だが、課金アカウントの設定は必要。課金の変更は所有者が確認して行う。
2. 本番・プレビュー用の専用キーを別々に作り、API restrictionsは **Maps Embed APIのみ**、Application restrictionsはWebsitesにする。
3. 本番の参照元は `https://path-guardian.com/*`。プレビューは実際のPRのURLだけを許可する。`workers.dev` 全体を許可しない。ローカルの接続確認が必要ならプレビューキーに対象のlocalhostポートだけを追加する。
4. 本番のGitHub Actions設定へ `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`、`cloudflare-preview` Environmentへ `PREVIEW_NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` を登録する。値をチャット・コード・ログに載せない。
5. クライアント用のビルド入力なので、登録後はCIで新しくビルドする。未設定でも他機能のビルドを継続し、景色画面は設定確認中の案内だけを表示する。既存の `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` へはフォールバックしない。

公開前には、実キーを設定したプレビューで両枠の実画像と地点ピン、Googleの権利表示、画像なしの地点、CSP・参照元制限を確認する。ネットワークで `/maps/embed/v1/place` と `/maps/embed/v1/streetview` を使い、アプリが Maps JavaScript API や Street View Static API を呼ばないことを確認する。Googleのiframe自身の内部通信とは区別する。

公式: [Embedの料金](https://developers.google.com/maps/documentation/embed/usage-and-billing)、[設定手順](https://developers.google.com/maps/documentation/embed/get-api-key)、[埋め込み方法](https://developers.google.com/maps/documentation/embed/embedding-map)。

## ARの従来ビューアのGoogle設定と公開前確認

以下は今回変更しないAR側のMaps JavaScript API方式の手順。地図側の無料Embed方式には適用しない。地図の無料化がAR側の料金・設定まで変更することを意味しない。

本番用とプレビュー用のGoogle Cloudキーを分け、Maps JavaScript APIを有効にする。キーは参照元URLとAPIを制限し、課金・使用量をGoogle Cloud側で確認する。

2026-10-30のユーザー回答では、両方のキーは**未設定**。現在、実画像での接続確認は未実施。

設定手順:

1. Google Cloud Consoleで請求先を確認したプロジェクトを選び、Maps JavaScript APIを有効にする。課金の有効化・変更は所有者が内容を確認して行う。
2. 本番・プレビューの2つのAPIキーを作る。Application restrictionsをWebsites、API restrictionsをMaps JavaScript APIに制限する。
3. 本番の参照元は `https://path-guardian.com/*`。プレビューはPRの実際のURLを登録する（`https://pathguardian-pr-<PR番号>.<Workersサブドメイン>.workers.dev/*`）。全ての `workers.dev` を許可しない。
4. GitHubのリポジトリSettings → Secrets and variables → Actionsへ本番名を登録する。プレビュー名はSettings → Environments → `cloudflare-preview` → Environment secretsへ登録する。以下の表の名前をそのまま使う。
5. キーを登録したらビルドを再実行する。`NEXT_PUBLIC_` はビルドに埋め込まれるため、既に生成したJSやWorkerだけを再利用しても反映されない。

公式手順: [Maps JavaScript APIの設定](https://developers.google.com/maps/documentation/javascript/get-api-key)、[Googleのキー制限](https://developers.google.com/maps/api-security-best-practices)、[GitHub ActionsのSecrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)。

| GitHub Actionsの設定名 | 用途 |
| --- | --- |
| NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | 本番ビルド |
| PREVIEW_NEXT_PUBLIC_GOOGLE_MAPS_API_KEY | cloudflare-preview Environmentのプレビュービルド |

キーは公開クライアント用のビルド入力。値をコード・文書・チャットへ記録しない。未設定でも他の機能は動作し、景色の画面には設定確認中と表示する。既存Workerの秘密値をローカルから変更する必要はない。

Googleへの読み込み・課金対象の呼び出しは景色のボタンを押したときだけ行う。事故地点から50m以内、Googleが撮影した屋外画像を検索し、パノラマIDで開く。撮影位置から事故地点を向く。画像の保存・加工・AIへの入力は行わない。Googleのロゴ・著作権を隠さない。

公開前に隔離プレビューで次を確認する。

- 認証した地図の丸から1回で開き、閉じたら位置と吹き出しが保持される。
- 実際のGoogle画像、撮影年月、地点とのずれ、Googleの権利表示、CSP違反なし。
- 画像なし・設定不足・通信失敗を区別し、古い地点の応答が新しい地点を上書きしない。
- 実機ARでカメラ・方角・位置の拒否、低精度・高速移動・バックグラウンド、カメラ停止と復帰を確認する。

本番公開はPRをmainに統合後、Cloudflare Production GitHub Actionsだけで行う。本作業から本番アプリの公開はしていない。

## 公的データの追加手順

Pythonの依存は `scripts/migrate/requirements-hazards.txt`。作業成果物は無視対象の `artifacts/migration/hazards` に置く。

```powershell
python scripts/migrate/prepare-official-hazards.py --catalog
python scripts/migrate/prepare-official-hazards.py --prepare A31b-25_20_6140_GEOJSON
python scripts/migrate/prepare-official-hazards.py --manifest lib/hazard-source-manifest.json
python scripts/migrate/import-official-hazards.py --directory artifacts/migration/hazards/prepared/A31b-25_20_6140_GEOJSON
```

最後のコマンドはローカル検証だけを行う。リモート投入は対象・規模を確認してから、同じコマンドに `--remote --database pathguardian` を明示する。別の準備成果物・出典版・行内容が既存データと混ざる場合は中止する。置換や削除を自動実行しない。地域を拡張するたびにrows_readを再測定する。

津波の条件付き利用地域はカタログで保留する。京都府・長崎県の事前連絡などは行っていない。追加の出典や利用条件を推測で許可しない。

## 検証の区別

ローカルのブラウザ検証は実際のUI部品と架空のfixtureを使う。本番の認証を回避するページは作っていない。Googleの正常応答・50m超・古い応答・認証失敗はモックを使うテストで確認し、Google実接続と実機カメラは公開前ゲートとして残す。

コードレビューで見つかった、同じ深さの離れた区域のマーカー欠落、再開時の行内容の不一致、追加出典のメタデータ欠落、誤ったデータ件数の読み上げ、景色を見ている間の方角変更による事故選択の切替は修正済み。最後の問題は、カメラの方向に関係なく選択中の事故を保持し、表示距離の外へ移動したときは外す回帰テストを追加した。

選択したデザインとの比較はルートの [design-qa.md](../../design-qa.md)。負荷測定とPaid前提の見積もりは [実装前確認](../plans/2026-10-29-ar-hazard-implementation-preflight.md) を参照。

2026-10-30のローカル検証では関連Vitest 18ファイル77件、プレビュー設定のNodeテスト9件、取り込みのPythonテスト6件が成功。アプリの型検査、Next本番ビルド、変更対象のOpenNextビルド（mapUi / aiVision / core）も成功した。実画像と実機センサーをモックテストで代替済みとは扱わない。

`tsconfig.worker.json` は全分割Workerの生成済みhandlerを参照する。対象3 Workerだけのビルドでは他の生成物がないため、全Workerを対象とする独立した型検査は未完了。公開前の全体ビルドと区別する。
