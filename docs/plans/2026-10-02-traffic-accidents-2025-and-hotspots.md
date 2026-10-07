# 交通事故オープンデータ2025年の取り込みと事故多発地点（2026-10-02）

## 何をしたか
- 警察庁が公開した2025年（令和7年）の本票 `honhyo_2025.csv` を `traffic_accidents`（D1 `pathguardian-traffic`）に追加する SQL を作った。
  - 列の並びは2024年版と同じ68列。ファイル定義書も、年の表記を除けば2024年版と同じ（diffで確認）。
- 警察庁「事故多発地点解析ツール」の**距離グループ集計**と同じ手順で事故多発地点を事前に計算し、新しいテーブル `accident_hotspots` に入れる SQL を作った。
  - 条件: 半径30m以内に、直近5年（2021〜2025）で5件以上。
  - 円が重なるときは件数の多い中心だけを残す。北緯20〜46度・東経122〜154度の外の点は除外する。
- 事故多発地点を表示する場所:
  - 地図の「表示」パネルの「事故多発地点」レイヤー
  - 通学路パネルの「この通学路の近くの事故多発地点」（通学路から50m以内）
  - 事故統計パネルとレポート詳細の「近くの事故多発地点」
  - 画像生成・きけんハンターの AI への注入文
- 「過去5年」の数え方を直した。
  - 以前は今年を基準に年数を増やしていたため、実際には6年分（レポートの再計算は4年分）を集計していた。
  - 今はデータの最新年から数える（`accidentYearWindow` → 2021〜2025）。

## 生成結果（ローカル）
| 項目 | 値 |
|---|---|
| 2025年 本票 | 287,023行。座標なしの3行を除き 287,020件を投入対象にした |
| 2025年 死亡事故 | 2,495件 |
| 1文あたりの最大サイズ | 36KB（D1の上限は100KB） |
| 多発地点 | 65,933か所。最多は兵庫県内の64件、2位は東京・環七大原交差点付近の61件 |
| 多発地点の計算時間 | 約30秒（149万件） |
| ローカル SQLite でのリハーサル | 287,020件が入り、同じ SQL を再実行しても増えない（冪等） |

## 決めたこと・前提
- `ACCIDENT_DATA_MIN_YEAR` を 2019 にした。
  - 本番の件数（年ごとの集計）では、2020〜2024年の合計が 1,484,137件、全体が 1,869,032件。差の約38万件は2019年分と判断した（2019年の全国の人身事故は約38万件）。
  - 2018年の行は無い見込み。
- `occurred_at` の書式は生成時に `--occurred-at` で必ず指定する（既定値なし）。
  - `jst`: `2025-01-02T11:50:00+09:00`（本当の時刻）。集計側（`dateParts`）は `+09:00` 付きを日本時間で読むので、時間帯・月の集計は正しい。
  - `wallclock-utc`: `2025-01-02T11:50:00+00:00`（日本時間の時刻をUTC表記で）。既存行がこの形ならこちらに合わせる。
  - 既存行の書式は本番を読めなかったため未確認。読み出し側はどちらも `new Date()` で解釈するので動作は同じ。
  - ただし `dateParts` は UTC の時を使っている。既存行が UTC で入っていれば、時間帯の集計で既存行と9時間ずれる可能性がある。**本番適用前に下の「突き合わせ」で確認すること。**
- `party_a_age` / `party_b_age` は本票の年齢区分コードを整数で入れる（01 → 1）。既存の「若年（=1）」「高齢（>=65）」判定と同じ。
- `involves_child` は常に 0。本票の年齢区分の最小が「0〜24歳」なので、子ども（15歳以下）は判別できない（2026-09-26 の補正と同じ扱い）。
- 重傷の件数は出さない。本票の人身損傷程度は「死亡・負傷・損傷なし」だけで、重傷を区別できない。
- `accident_hotspots` のマイグレーションは2つある。
  - `lib/db/traffic-migrations/0002_accident_hotspots.sql`: traffic D1 用。`IF NOT EXISTS` 付きで、`--file` で単体適用しても安全。
  - Drizzle のメイン側スナップショット `lib/db/migrations/20261001235738_accident_hotspots.sql`
- `/api/traffic-accidents/__health` は件数の完全一致を見る。取り込み前（1,869,032）と取り込み後（2,156,052）の両方を正常として受け付ける。取り込みが終わったら旧値を消してよい。

## 敵対的レビュー（2026-10-02）で直したこと
- 2025年行（`+09:00`）の時間帯・月の集計が9時間ずれていた → `dateParts` で `+09:00` 付きを日本時間で読むよう修正。既存行の読み方は変えていない。
- 「近くに事故多発地点がNか所」が上位3件で頭打ちになっていた → 総数 `hotspot_count` を返し、パネルと注入文は総数を使う。
- 7年より長く要求すると「過去10年間（2019〜2025年）」と食い違っていた → 実際に集計した年数を書く。
- 一時テーブルに索引が無く、都道府県ごとの INSERT で51回全件走査していた → 索引を追加。実行計画で使われることを確認した。
- 全国表示で毎回6.6万件を並べ替えていた → ズーム10未満では取得せず「拡大すると表示されます」と出す。2000件で打ち切ったときもその旨を表示する。
- 通学路を編集しても一覧が古いままだった → `updated_at` が変わったら取り直す。
- 多発地点のSQLが「削除してから入れる」で原子的でなかった → 削除を `hotspots-reset.sql` に分けた。
- その他: 部品が外れたときに地図のレイヤーを外す、`--top` の検証、非有限の数値を SQL に入れない、改行コードを元の CRLF に戻した。
- 仕様として残したこと: 採用済みの中心から30m以内の候補だけを捨てるので、中心が30〜60m離れた多発地点の円は重なり、境界付近の事故が両方に数えられることがある。警察庁ツールのマニュアル（2.3節「グループ化半径以内の点について…最も大きいもの以外を除外」）と同じ扱い。

## 本番への適用手順（人が確認しながら・各段階の前に止まる）
CSV の取得先: `https://www.npa.go.jp/publications/statistics/koutsuu/opendata/<year>/honhyo_<year>.csv`（2021〜2025）

```bash
# 0. SQL を生成する（D1 には書かない）
pnpm tsx scripts/migrate/import-traffic-honhyo-year.ts --csv-dir=<dir> --year=2025 --out=<out>/import-2025 --occurred-at=<手順2で決める>
pnpm tsx scripts/migrate/build-traffic-hotspots.ts --csv-dir=<dir> --out=<out>/hotspots

# 1. 復元点を控える（ID はリポジトリに書かない）
npx wrangler d1 time-travel info pathguardian-traffic -c wrangler.server.jsonc

# 2. 突き合わせ（読み取りのみ）: 2024年の数行を本番から抜き出し、同じ変換の結果と全列を比べる
#    特に occurred_at の書式、municipality_code の桁、weather_code、day_night_code
#    occurred_at が「日本時間の時刻なのに +00:00 / Z」の形なら、手順0を --occurred-at=wallclock-utc で作り直す
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --command \
  "SELECT * FROM traffic_accidents WHERE source_year=2024 AND prefecture_code=10 ORDER BY record_number LIMIT 5"

# 3. 2025年分
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=<out>/import-2025/preflight.sql   # 0 であること
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=<out>/import-2025/stage-0-create.sql
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=<out>/import-2025/stage-2025.sql  # 約100MB
#    → SELECT COUNT(*) FROM traffic_import が 287020 であること
#    apply-chunks.txt を1行ずつ --command で流す（都道府県ごとの INSERT … SELECT。51文）
#    → SELECT COUNT(*) FROM traffic_accidents WHERE source_year=2025 が 287020 であること
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=<out>/import-2025/cleanup.sql

# 4. 事故多発地点
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=lib/db/traffic-migrations/0002_accident_hotspots.sql
npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=<out>/hotspots/hotspots-insert.sql  # 約11MB・660文
#    → SELECT COUNT(*) FROM accident_hotspots WHERE dataset_version='2021-2025_r30_n5' が 65933 であること
#    途中で失敗したら hotspots-reset.sql（同じ版を消す）を流してから insert をやり直す
```

- 費用の目安: D1 への書き込みは約57万行（stage と insert）に多発地点の約6.6万行を足した程度で、月間無料枠の範囲内。
- 戻し方: time-travel で restore する。多発地点だけを戻すなら `DROP TABLE accident_hotspots`。アプリは取得に失敗しても事故統計を返し続ける。
- 順番: **データ投入（手順3・4）を先に、アプリのデプロイ（main への push → Workers Builds）を後に**行う。
  - アプリは「過去5年＝2021〜2025年」で数えるため、2025年分が入る前にデプロイすると、実際は4年分なのに「過去5年」と表示される。
  - 多発地点テーブルが無いと、地図レイヤーと通学路一覧がエラー表示になる。事故統計パネルでは多発地点の欄が出ないだけで済む。
  - 全 Worker を同じビルドで出すこと（バージョンのずれに注意）。

## 来年（2026年分）の手順
1. `ACCIDENT_DATA_MAX_YEAR` を 2026 にする。`HOTSPOT_DATASET_VERSION` は自動で `2022-2026_r30_n5` に変わる。
2. 上の手順0〜4を `--year=2026` で行う。
3. 新しい版を確認してから `hotspots-cleanup-old.sql` で古い版を消す。
4. ヘルスチェックの件数を更新する。
