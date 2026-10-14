# 全国集計の隔離プレビュー登録

`Accident Preview Data Stage` は PR #250 の同一リポジトリ・
`codex/accident-rankings` の更新だけを対象にする。現在の open PR の HEAD と
checkout が一致してから、`cloudflare-preview` 環境の承認を経て実行する。
独立した concurrency group と `cancel-in-progress: false` により、通常の
プレビュー更新が取り込みを途中でキャンセルしない。

対象は `pathguardian-traffic-preview`
(`a5404251-54d6-48e0-9f9d-111c206f5ce6`) のみ。本番 ID、別アカウント、
別 binding/name を拒否する。CLI に任意の対象を渡す入力は設けない。

GitHub release ID `412514430` の固定 asset ID から manifest と SQL archive を取得する。
未公開の下書きは自動で公開しない。manifest と archive の固定 SHA256、全84SQLファイルの
SHA256/サイズ、tar の通常ファイル許可リスト、リポジトリの schema SHA256 を照合する。
取得失敗・権限不足時にはデータベースへの変更前に止まる。
GitHubが未公開draftを読み取り専用トークンに返さないため、この専用ジョブに限り
`contents: write` を付与する。取得スクリプトはrelease/assetにGETのみを使用し、
draftの公開・編集、リポジトリへのpushを行わない。他のプレビューCI権限は変更しない。

新しい版 `national-current-rule-v1-20261014` のみ INSERT する。既存の未公開版があれば
追加取り込みせず停止する。部分データを削除・置換して再開しない。失敗時の成果物を保持し、
原因と登録済みファイルを調査して別の明示的な復旧手順をレビューする。

登録後は6テーブル計1,305,916行、全国47都道府県、事故件数329,033、
未確定1,842,634、対象外10,631、元件数2,182,298との一致、snapshot metadata、
外部キーを確認する。その後だけプレビューの該当版を有効にする。
公開済みの同版は同じ検証を通した場合だけ再利用する。

プレビュー有効化はブラウザー検証の開始条件であり、本番公開の承認ではない。
未ログインの全国検索、千葉県→柏市→自転車→地点詳細、地図同期、条件の復元、
空表示と再試行、390×844の操作を実データで確認する。本番登録・公開の経路は別途、
全国品質確認後の最新mainの `Cloudflare Production` とする。

集計の限定条件、出典と利用条件は `current-geometry-rule-v1.md` と
`data/national-public-source-notices-v1.json` を参照する。
