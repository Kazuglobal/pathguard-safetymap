# 小学校区の地域アラート

「今日の地域アラート」は都道府県、市区町村、小学校区を選ぶまで取得を行いません。
学区マスターで保存内容を検証した後、選んだ学区に関連付いた過去24時間の情報を取得します。
全国・都道府県検索APIとプッシュ通知の対象範囲は引き続き利用できます。

## データの準備

出典は[国土数値情報 小学校区（2023年度）](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-A27-2023.html)、自治体名は[国土地理院の自治体コード](https://maps.gsi.go.jp/js/muni.js)です。加工して学区マスター・境界に変換します。
利用条件に制限のない自治体のみ取り込み、制限・特記事項・識別情報不足はmanifestのexcludedに記録します。未収録の地域は画面で未対応になります。
2023年度のデータは現在の通学区域の確定資料ではありません。

PowerShellで、リポジトリのルートから実行します。Python 3とpnpmを使用します。

```powershell
New-Item -ItemType Directory -Force tmp/school-districts | Out-Null
Invoke-WebRequest 'https://nlftp.mlit.go.jp/ksj/gml/data/A27/A27-23/A27-23_GML.zip' -OutFile tmp/school-districts/A27-23_GML.zip
Invoke-WebRequest 'https://maps.gsi.go.jp/js/muni.js' -OutFile tmp/school-districts/muni.js
Invoke-WebRequest 'https://nlftp.mlit.go.jp/ksj/gml/codelist/R5_Terms_of_use_municipality_data.xlsx' -OutFile tmp/school-districts/terms.xlsx
python scripts/migrate/prepare-school-districts.py --archive tmp/school-districts/A27-23_GML.zip --municipalities tmp/school-districts/muni.js --terms tmp/school-districts/terms.xlsx --output tmp/school-districts/sql
pnpm exec wrangler d1 migrations apply pathguardian --local
pwsh -NoProfile -File scripts/migrate/import-school-districts.ps1 -Directory tmp/school-districts/sql -Target local
```

生成結果はmanifest.jsonに学区数、境界数、47県のSQLファイル、除外理由を記録します。
2026-10-10の取得分では14,273学区・15,474境界です。ダウンロード内容の変更で件数は変わります。
境界を複数のPolygonに分け、長いJSONはSQLの一時チャンクから復元します。原座標を簡略化しません。

## 自治体資料による更新

自治体ごとの完全なスナップショットをGeoJSON FeatureCollectionで用意します。
propertiesは `municipalityCode, schoolCode, prefecture, city, name, sourceUrl, dataYear`、geometryは日本の経緯度のPolygon/MultiPolygonです。
資料の利用条件を確認し、出典URLと年度を設定します。同名校も自治体コードと学校コードで区別します。

`tmp/municipal-update.geojson` は自動で用意されるファイルではありません。自治体の最新資料から作成した実ファイルを指定してください。
取得済みの公的な2023年度データで新宿区（13104）の取り込みを確認する場合は、まず次のコマンドで実データを抽出できます。このデータは自治体の最新資料による更新ではなく、2023年度の基礎データです。

```powershell
python scripts/migrate/prepare-school-districts.py --archive tmp/school-districts/A27-23_GML.zip --municipalities tmp/school-districts/muni.js --terms tmp/school-districts/terms.xlsx --municipality-codes 13104 --export-geojson tmp/municipal-update.geojson --output tmp/school-district-update
if ($LASTEXITCODE -ne 0) { throw '新宿区の入力データの準備に失敗しました。上のエラーを確認してください。' }
```

入力ファイルがある状態で次を実行します。先行コマンドが失敗した場合は、取り込みへ進みません。

```powershell
python scripts/migrate/prepare-school-districts.py --geojson tmp/municipal-update.geojson --municipality-codes 13104 --output tmp/school-district-update
if ($LASTEXITCODE -ne 0) { throw 'SQLの生成に失敗しました。入力ファイルを確認してください。' }
pwsh -NoProfile -File scripts/migrate/import-school-districts.ps1 -Directory tmp/school-district-update -Target local
```

明示された自治体の旧学区と関連付けを削除してから取り込みます。廃校による空のスナップショットにも対応します。
再取り込み後は必ずアラートを再判定してください。旧境界での関連付けを残しません。

## 発生場所の判定と再判定

収集処理は出典本文から対象事案の発生場所・原文抜粋を抽出して、原文への存在を確認します。
本文取得先は公的ドメイン・NHKに限定し、リダイレクトは拒否、本文は1MB、抽出資料は60,000文字までです。
場所を確認できない出典も従来の地域情報には保存しますが、学区アラートには含めません。

既存Mapboxトークンを使うGeocoding v6の `permanent=true` で住所を解決します。
住所一致がexact、位置精度がrooftop/point、都道府県と市区町村が一致し、一意の住所候補だけを採用します。
代表点・距離・推測住所は使いません。境界・穴から50m以内は除外し、重複学区はそれぞれに関連付けます。
座標と原文はサービス権限専用のテーブルに保持し、公開APIへ返しません。

POST `/api/cron/local-alert-district-backfill?since=<ISO日時>&cursor=<前回nextCursor>` を `Authorization: Bearer <CRON_SECRET>` で呼びます。
１回10件ずつ判定し、同じsinceを保ってnextCursorがnullになるまで繰り返します。sinceの省略時は過去24時間です。
返却・ログのchecked/matched/unmatched/failedを確認し、failedがあれば同じページを再実行します。
新しい定期スケジュールは追加していません。新規収集分は既存の3時間ごとの処理で判定します。

## 本番への反映

1. 画面を切り替える前に、本番D1へマイグレーションを適用する。
2. メンテナンス時間中にインポート処理を `-Target remote` で実行し、件数をmanifestと照合する。途中失敗時は同じインポートを再実行する。
3. 新APIと収集処理を含むWorkersを反映する。school-districtsとbackfillはOPERATIONSへ振り分ける。
4. 保存済みアラートを再判定し、判定件数・地域選択・更新を確認する。

この実装では本番へのデプロイは自動実行しません。追加テーブルの準備がない環境では学区読み込みエラーを表示し、全国情報に戻しません。

## 検証

```powershell
pnpm exec vitest run tests/unit/lib/school-districts.test.ts tests/unit/lib/local-alert-location.test.ts tests/unit/db/school-districts-repo.test.ts tests/unit/app/api/school-district-alerts.test.ts tests/components/local-safety-alerts-selection.test.tsx
python tests/scripts/test_school_district_import.py
pnpm typecheck
```

実装時の検証では関連Vitest 102件、Pythonの取り込みテスト5件、D1上の関連付けと件数制限を確認しました。
全国データをローカルD1へ取り込み、47都道府県・1,561自治体・14,273学区・15,474境界、JSON不正0件を確認しています。
画面は独立プレビューで実際の学区マスターを利用し、390px/1280px幅の表示、キーボードによる学区選択、選択前にアラート通信がないことを確認しました。アラート本体は空データの検証用応答です。
プレビュー画像は `tmp/school-districts/mobile-unselected.png`、`mobile-selected.png`、`desktop-selected.png` です。
アプリ本体（既存tmp/scratchpadの監査プロジェクトを除外）とWorkersの型チェックは通過しています。
通常の全体型チェックは既存のtmp監査プロジェクトの型エラーで失敗し、Next開発サーバーは既存のOpenNext依存パッチによる `runMiddleware should not be called with OpenNext` で500を返します。本番公開時には、別機能の未コミット変更とtmp監査プロジェクトを含めない専用コピーでビルドしました。

## 2026年10月10日の本番反映

本番D1に学区用マイグレーションだけを適用し、全国14,273学区・15,474境界を登録しました。47都道府県・1,561自治体、データ年度2023、境界JSON不正0・孤立境界0を確認しています。

学区機能を含むOperations、Editorial、Core、Routerを公開しました。専用コピーの関連テスト24件、Next.jsの型チェックと本番ビルド、Wrangler dry-runのサイズ検証は成功しています。作業記録は `tmp/school-district-release/` に保存しています。

部分デプロイでは、今回公開しない既存Workersが古いビルドのJavaScriptを参照します。Routerの静的ファイルを新しいビルドだけで置き換えると既存ログイン画面などで404になるため、既存Workersの参照先と旧Webpackランタイムから取得した102個の静的ファイルも公開用フォルダへ保持しました。次の部分デプロイでも既存Workerの参照ファイルを保持し、学区画面とログイン画面の両方で静的ファイルの正常応答を確認してください。

本番では新宿区の29学区取得、学区アラートの正常応答、学区未選択時の通信停止、選択の復元、都道府県変更時の市区町村・学区解除、390px/1280px幅の表示を確認しました。既存アラートは過去24時間の9件を再判定し、該当0・場所を確定できず除外9・処理失敗0でした。場所を推測して学区へ関連付けることはしていません。
