# traffic_accidents 補正（警察庁 本票 CSV からの backfill）

## 見つかった不具合（2026-09-26）
本番 D1 `pathguardian-traffic` の `traffic_accidents`（約187万件）で、取り込み時の対応表の誤りにより次の値が壊れていた。

| 列 | 状態 | 影響 |
|---|---|---|
| `accident_type_label` | 大分類コード（01/21/41/61）に「車両相互_正面衝突」「人対車両_横断中」などの詳細名が付いている。本票の事故類型は大分類しか持たないので、詳細名は根拠なし | 事故統計パネル・AIへの注入文・横断中の件数（`crossingRows`）が誤り |
| `involves_pedestrian` | 常に 0 | 歩行者関与の件数・地図の歩行者フィルタが 0 |
| `party_*_type_code/label`、`road_surface_*`、`road_shape_*`、`sidewalk_*`、`terrain_*`、`injury_level_*` など | 空（NULL） | 当事者種別・路面・歩道の分析タブが空 |
| `involves_child` | 常に 0。**本票の年齢は最小区分が「0～24歳」なので、子ども（15歳以下）は元データからも判別できない** | 「子どもの事故」表示は元データ的に出せない（`hasYoung` = 24歳以下で代替） |

## 対応
1. **コード修正（済み・本番DBは触らない）**
   - `lib/traffic-accident/codes.ts`: コード→大分類、人対車両→歩行者関与
   - `lib/db/repos/accidents.repo.ts`: 読み出し時に正規化（`normalizeAccidentRow`）、歩行者フィルタに人対車両を含める、
     年の絞り込みを `IN (...)` に変更（`>=`/範囲だと D1 の索引が年で止まり1回約150万行を読んでいた）
   - テスト: `tests/unit/lib/traffic-accident-codes.test.ts`、`tests/unit/db/accidents-repo.test.ts`
2. **データ補正（2026-09-26 本番適用済み・下の「適用結果」参照）**: 本票 CSV から正しい値を作り、キー（source_year, prefecture_code, police_station_code, record_number）で UPDATE
   - 変換: `lib/traffic-accident/honhyo.ts`（見出し名で列を引く。2020-2021 は58列、2022以降は68列）＋ `lib/traffic-accident/npa-codebook.json`
   - 生成: `pnpm tsx scripts/migrate/backfill-traffic-from-honhyo.ts --csv-dir=<dir> --years=2020-2024 --out=<dir>` → stage.sql / apply.sql / cleanup.sql
   - リハーサル（ローカル SQLite）: 補正値 1,514,038 件・キー重複 0、本番から抜き出した32件は32件とも一致し、当事者種別・路面・歩行者関与が復元された
   - 2019年分は CSV を追加すれば同じ手順で補正できる

## 本番への適用手順（人が確認しながら）
1. 復元点を控える: `npx wrangler d1 time-travel info pathguardian-traffic -c wrangler.server.jsonc`
2. `npx wrangler d1 execute pathguardian-traffic -c wrangler.server.jsonc --remote --file=stage.sql`（約151万行の書き込み、約390MB）
3. 件数確認: `SELECT COUNT(*) FROM traffic_backfill`
4. `--file=apply.sql`（traffic_accidents 約151万行を UPDATE）
5. 抜き取り確認: 数地点で `party_a_type_label`・`road_surface_label`・`involves_pedestrian` が入っているか
6. `--file=cleanup.sql`
- 費用: D1 の書き込みは約300万行（stage＋apply）。有料プランの月間無料枠（5,000万行）内の見込み
- 戻し方: time-travel の復元点に restore

## 適用結果（2026-09-26）
- 適用前の復元点は time-travel で控えた（ID はリポジトリに載せない）
- stage: 年ごとに `--file`（stage-0 は `--command`）。件数 309,178 / 305,196 / 300,839 / 307,930 / 290,895 ＝ 1,514,038（生成時と一致）
- apply: 索引2本 → 1年×1都道府県の UPDATE 255文を1文ずつ `--command`。全文成功、更新 1,481,084 件（1文 3〜260ms）
- 確認: 2020-2024 の当事者種別・路面が入った行 99.8%（未一致は本番側に対応する本票行が無いもの）。事故類型 01 は involves_pedestrian=1、詳細名なしの大分類ラベル
- cleanup 済み（traffic_backfill と idx_traffic_accidents_record_key を削除）
- 注意: 1文 400 行の INSERT は SQLITE_TOOBIG（100KB 超）で失敗する → BATCH=100。`--file` の import API は一度だけ認証エラー（10000）を返したが再実行で通った
