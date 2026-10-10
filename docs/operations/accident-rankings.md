# 公開事故ランキングの集計・更新

## 今回確認できたこと（2026-10-10）

- 既存実装は Next.js / Cloudflare D1 / Mapbox。Supabaseは認証に使用する。
- 元の作業場所のローカルD1には事故テーブルがあるが、レコードは0件。
- 本番の件数・収録年度・欠損・重複は未確認。読み取り専用Wrangler実行は認証設定不足で失敗した。
- 2026-09-26の補正記録にある約187万件は過去の記録であり、現在件数ではない。
- 既存年度定数は2018–2024。新機能はこの定数を流用せず、公開済み集計版の検証済み年度を使用する。
- ローカルの honhyo_2022.csv / honhyo_2023_to-degree.csv の見出しには置換文字がある。原本として採用せず、警察庁の原本を再取得して定義書と照合する。
- 警察庁の公開一覧で2025年分も確認済み。ただし、この作業では取得・取り込み・全国集計の完了を確認していない。

集計可能なランキングは事故件数、死亡事故件数、自転車・歩行者が関係した事故件数、時間帯別の事故件数。交差点・道路への割り当てと収録範囲の確認が公開の前提となる。子どもだけの分類は提供しない。

追加データは警察庁の年度別本票・定義書・コード表、OpenStreetMapの道路ノード/ウェイ、国土数値情報の行政区域。提供元の利用条件、対象年、取得日、ファイルのSHA-256を保存する。日本損害保険協会の交差点資料は外部照合に使用し、集計定義の異なる結果との一致は強制しない。

## 入力と処理

既存の事故テーブルを更新しない。以下はすべてオフラインで、新しい出力先へ生成する。秘密情報は入力や出力に含めない。

1. 警察庁の原本を `normalize_npa.py` でUTF-8 CSVへ変換する。対象年ごとに原本の定義書を確認し、列名を対応づけたJSONを指定する。文字化けした見出しや列位置の推測は許可しない。
2. 行の識別は年度・都道府県・警察署・本票番号。同じキーの同一行だけ重複除外し、内容の異なる同一キーは処理を停止する。別年度の事故を削除しない。
3. OSMのノード・ウェイJSONと行政区域GeoJSONから `prepare_locations.py` で候補地点を生成する。共有ノードと道路接続数で交差点を判定し、道路は交差点/ウェイ端点で区切る。単なる座標交差は接続扱いにしない。
4. 候補はすべて `reviewed:false`。近接する別交差点、分割されすぎた交差点、行政境界、立体構造、道路名を重点確認し、確認済み候補だけ `reviewed:true` にする。自動生成だけで「正確な交差点」を主張しない。
5. `build_snapshot.py` は交差点30m、道路20m以内の候補を照合する。複数交差点、複数道路、複数層、橋やトンネルなど高度が確定できないものは未確定。交差点候補が1つなら接続道路より優先する。1事故を1地点にだけ割り当てる。
6. 10/20/30/50mの比較、年度別件数、重複、異常座標、割り当て済み・未確定・対象外を `quality.json` に保存する。割り当て済み＋未確定＋対象外＝重複除外後の事故数を必須とする。

正規化CSV列：`source_year,source_prefecture_code,prefecture_code,police_station_code,record_number,municipality_code,latitude,longitude,occurred_at,party_a_type_code,party_b_type_code,fatalities,accident_type_code`。地理フィルターに使う地域コードは全国地方公共団体コード。原データの都道府県コードは定義JSONの `prefectureMap` で対応づける。時刻は日本時間 `+09:00` を保持する。小分類のない事故に詳細類型を作らない。

定義JSONは `year,coordinateFormat`（`dms` / `decimal`）、`municipalityFormat`（`local3` / `full5`）、`prefectureMap,columns` を含める。`columns` のキーは `record_type,prefecture,station,number,municipality,latitude,longitude,year,month,day,hour,minute,party_a,party_b,fatalities,accident_class`。値はその年度の原本にある正確な見出し名。度分秒は度×10^7＋分×10^5＋秒×10^3を解釈する。原本の形式が異なる場合はこの変換を使用しない。

行政区域GeoJSONはPolygon/MultiPolygonと `prefecture,prefectureName,municipality,municipalityName` を持つ。国土数値情報の原本をこの形式へ変換し、穴・境界・地域コードを検証する。候補GeoJSONはPoint/LineStringと `id,kind,prefecture,municipality,name,address,layer,reviewed` を持つ。名前がない場所は住所＋「付近」と表示する。

## 集計版の検証と登録

manifest JSONは `version,updatedAt,years,sources,codebooks,review` を持つ。`sources` の各項目は `name,url,license,retrievedAt`。`codebooks` は年度文字列をキーとして `bicycle,pedestrian,pedestrianClasses,classes` を持ち、各年度の公開コード表で確認した値だけを設定する。

`review` は `inputHashes`（`records,locations,areas` のSHA-256）、`expectedUniqueRecords`（原本との照合件数）、`completeCoverage:true` を必須とする。署名済み承認の代替ではなく、担当者が確認した入力と生成入力が一致するためのチェック。部分抽出を全国データとして承認してはいけない。

```powershell
python scripts/accidents/normalize_npa.py --input original.csv --definition reviewed-2025.json --output normalized-2025.csv
python scripts/accidents/prepare_locations.py --osm osm-nodes-ways.json --areas municipalities.geojson --output candidates.geojson
python scripts/accidents/build_snapshot.py --records normalized.csv --locations reviewed-locations.geojson --areas municipalities.geojson --manifest reviewed-manifest.json --output artifacts/accidents/new-version
```

生成物は `snapshot.sqlite,quality.json,stage.sql,publish.sql`。SQLは1行ずつINSERTし、D1の文サイズ制限を避ける。既存版へ上書きしない。公開フラグは生成時に0であり、画面から見えない。

新規マイグレーション `0002_accident_rankings.sql` と生成SQLをまず隔離プレビューに適用する。登録後にSQL件数・年度・品質レポートと一致を確認し、公開フラグを切り替える。旧版は追加ページ/共有リンク用に維持する。APIは生の事故行ではなく公開フラグのある集計だけを読む。

## 公開と残作業

コードの本番公開は最新mainへのPR・CI・Cloudflare Production GitHub Actionsのみ。ローカルWranglerで本番Workerやsecretを変更しない。

本番データの読み取り認証、原本の再取得、2025年の列/コード定義確認、全国OSM・行政区域の取得と正規化、千葉県/柏市を含む候補のレビュー、全国品質照合、D1への検証済み集計版登録が完了するまで、実ランキングの公開は保留する。未登録時は「集計準備中」であり、架空の数字を表示しない。

## 検証

```powershell
pnpm exec vitest run tests/unit/lib/accident-rankings.test.ts
python -m unittest discover -s tests/scripts -p test_accident_snapshot.py
```

未ログインで地域・事故条件を選び、地点詳細へ移動、戻る、一覧/地図を切り替える。順位の同点、集計版固定、未収録地域、0件、通信失敗/再試行、位置選択同期を確認する。ブラウザーの試験用事故データを実データとして公開しない。

### 2026-10-10 実装確認

- 集計APIのVitest 10件、Pythonの空間割り当て・照合テスト8件が成功。
- レビュー指摘の地図リサイズ、年度コード表、未収録地域、集計版固定、立体道路、行政区域境界の距離比較を修正。
- localhostの未ログイン画面で検索操作、通信失敗、再試行の表示を確認。D1接続・Mapbox認証未設定のため正常データ状態と一連の地域検索は未確認。
- 全体の型検査は依存ライブラリ・既存ファイルのエラーで不合格。新規集計モジュールのエラーは出ていないが、CIで改めて確認が必要。
- 見た目の確認は `accident-rankings-design-qa.md` に記録。スマートフォンの同一条件比較は未完了。

事故識別には原本の `source_prefecture_code` を使う。北海道の方面別コードをJISの01へ変換した後のコードでは重複判定しない。

### 本番D1の読み取り確認（2026-10-10）

CLIの認証がない状態でも、ログイン済みCloudflareコンソールからSELECTのみで確認した。対象は `pathguardian-traffic.traffic_accidents`。既存データを変更していない。

|年度|保存件数|A・B両方の種別が欠けている件数|
|---|---:|---:|
|2018|10,393|10,393|
|2019|374,502|374,502|
|2020|303,102|690|
|2021|300,316|659|
|2022|295,996|877|
|2023|302,347|827|
|2024|282,376|0|
|2025|287,020|0|

合計2,156,052件。2025年データは既に保存されているため、再取り込み前に原本と現行取り込みの差分を調べる。2018年は限定収録の可能性があり、年度の選択肢へ無条件で加えない。

年度・現行都道府県コード・警察署・本票番号の重複キーは各年度0件。緯度経度のNULL/日本の概略範囲外、市区町村コードの空値、発生日時の空値も各年度0件。ただし座標変換の正しさ、境界との一致、日時のタイムゾーン、原本識別子を保証する検査ではない。

市区町村コードは全年度3桁。全国地方公共団体コードへ対応づける必要がある。A・B種別のNULLは2018・2019年の全件、2020〜2023年の一部で一致しているため、自転車条件を正しく提供するには原本との補完・照合が必要。

2025年の定義書とコード表の公開を確認したが、現行287,020件と原本との照合は未完了。出典: https://www.npa.go.jp/publications/statistics/koutsuu/opendata/2025/opendata_2025.html

CIのクリーンなNode22環境では全体の型検査・既存回帰・事故集計テストが成功。ローカル型エラーはCIでは再現しない。
