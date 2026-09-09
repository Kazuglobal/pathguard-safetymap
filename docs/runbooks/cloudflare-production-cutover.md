# Cloudflare 本番切替 Runbook

対象構成は Cloudflare Workers（OpenNext）+ D1 + R2 です。Supabase は Auth のみ継続します。コマンドはリポジトリ直下から実行し、秘密値はシェル／CI の環境変数または Cloudflare Worker Secret にだけ設定してください。

## 現在の本番状態（2026-09-03）

- Workers Free の15 Worker分割構成（公開router 1 + service Worker 14）を `https://path-guardian.com` へデプロイ済み。2026-09-03の全Worker再デプロイ後、D1日次backup Workflowを含むrouter versionは `8e8ca768-0b13-486e-916f-785efa377305`。
- Cloudflare Custom Domain/TLS/HSTSは有効。`workers.dev` とPreview URLは無効化し、公開面を本番custom domainだけに限定している。
- 本番smoke testは `/` 307→`/lp`、`/lp`・`/safety-quest`・`/login`・`/api/local-safety-alerts` 200、`/routes` 307→`/login?next=%2Froutes`、`/api/debug-env` 404を確認済み。
- routerのCron Triggerは `*/5 * * * *` の1本で、内部dispatcherから各定期処理を起動する。
- `CRON_SECRET` は2026-09-02に64-byte相当のランダム値へローテーションし、router 1 + service Worker 14の全15 Workersへ同一値を直接設定済み。値はローカルファイルへ保存しておらず、次回deployで旧値へ戻らないよう `.env.local` の旧行も削除済み。変更直後のWorker error tailでも認証エラーは観測されなかった。
- `pathguardian-traffic` の `traffic_accidents` は1,869,032行。main D1 `pathguardian` に残っていた同一件数の重複テーブルは、Time Travel bookmark取得後に承認を得て削除済み。
- main D1は重複データ削除後に約506 MBから縮小し、2026-09-03の最終migration後は811,008 bytes。traffic専用D1は約488 MBを維持している。
- D1 migration `20260902141605_hunter_detection_kind.sql` は2026-09-03に本番適用済み。`hunter_detections.kind` と `hunter_detections.accident_link` の両columnをremote D1で確認した。
- `path-guardian.com` はCloudflare Registrarで取得済み。Supabase Auth Site URLは `https://path-guardian.com`、Redirect URL allowlistは `/auth/callback` と `/reset-password` を追加済み（旧URLは24時間rollback用に一時保持）。
- R2 public custom domain `https://media.path-guardian.com` はTLS 1.2以上・Access EnabledでActive。CORSはorigin `https://path-guardian.com`、methods `GET, HEAD` に更新済み。本番CSP/HTMLはcustom domainを参照し、旧 `.r2.dev` 参照がないことをsmoke testで確認済み。Public Development URLは2026-09-01（JST）に無効化し、旧URLが401、本番custom domainが継続応答することを確認済み。
- `PathGuardian R2 media cache` Cache RuleをActive化済み。`https://media.path-guardian.com/*` をcache eligible、Edge TTL 1年、status code 400以上をNo storeとしている。
- D1長期backup用scoped token `D1_BACKUP_API_TOKEN` はWorker Secretへ設定済み。日次Workflowは18:00 UTCにrouterの既存cronから起動する。2026-09-02の本番検証ではinstance `cf_b0a7425c3e04e4e8b467f23c15701ca59e33bc87a1e551066d6191ff35c853bf` が5秒で成功し、`pg-backups/d1/2026-09-02.sql.gz`（50.47 KB）を生成した。
- Supabase Storageの全量backupは2026-09-02に完了。3バケット262 objects・602,253,983 bytesをローカルへ保存せず `pg-backups/supabase-storage-pre-cutover/20260902T090351Z` へ直接転送した。全262件でsource metadataのsize一致、SHA-256形式、宛先一意性を確認し、receiptは `artifacts/migration/storage-backup-20260902T090351Z/receipt.json` に保存した。Cloudflare Dashboardでも同prefix配下に `avatars/`、`danger-reports/`、`hunter-photos/` が存在することを確認済み。
- Supabase Postgresのroles・schema・COPY data backupは2026-09-02に完了。Supabase公式CLIで取得してgzip圧縮し、`pg-backups/postgres-pre-cutover/20260902T115104Z` へ保存した。3ファイル合計90,657,486 bytes、SHA-256全件正常、Cloudflare Dashboardで3ファイルとmanifestを確認済み。一時平文／圧縮ファイルは削除済みで、ローカルにはhash manifestだけを `artifacts/migration/postgres-backup-20260902T115104Z/manifest.json` に保持する。
- Workers Paidには移行していない。CloudflareのBudget Alertは通知であり強制停止上限ではないため、上限付き運用という要件を満たせない。15 Worker分割とcron集約によりWorkers Freeを維持する。
- Supabase DB passwordは最終backup後の2026-09-02にローテーション済み。旧 `supabase/.temp/pooler-url` キャッシュを削除し、変更後もSupabase Auth health・本番login・本番APIが200であることを確認した。
- Supabase Security Advisorの `danger_reports_public_preview` SECURITY DEFINER ERRORは、移行 `retire_public_danger_preview_after_d1_cutover` で旧viewの `anon` / `authenticated` SELECTをrevokeして外部到達不能にした。`service_role`はrollback用に保持する。ERRORは2件から1件へ減少した。
- 残るERRORはPostGIS拡張が所有する `public.spatial_ref_sys` のRLS無効だけである。これは拡張管理テーブルへのRLS追加で地理関数を破損させないため変更せず、PostGIS例外として扱う。Data APIのpublic schemaを完全廃止するまでは記録を維持する。
- `spatial_ref_sys` PostGIS例外は2026-09-02に明示承認済み。
- Supabase `public.traffic_accidents` はD1の1,869,032行一致とR2 backupを確認後、2026-09-02に承認済みTRUNCATEを実施した。Supabase側は0行、専用D1は1,869,032行を維持し、Supabase DBは約1.099 GBから130,650,927 bytes（125 MB）へ縮小してFree 500 MB上限未満になった。`accident_parties` 403,539行とAuth/Storageは保持している。
- Git履歴で漏えいが確認された認証情報は旧Gemini APIキー1件。現在の本番 `GEMINI_API_KEY` は旧値と異なり、Google Cloudの `safeguard`（2026-04-20作成、Gemini APIのみに制限）と一致するためローテーション済み。2026-09-02にGoogle Generative Language APIへ値を記録しない状態確認を行い、現行キーはHTTP 200、旧履歴キーはHTTP 400 `INVALID_ARGUMENT` の明示的なinvalid-key判定だった。旧キーは無効化済みで追加削除は不要。Postgres/Storage backup、source/D1件数照合、PostGIS例外承認、Supabase容量解消を含む本番切替必須作業は完了済み。

## 1. 事前条件

- Node.js 22 以上、pnpm 9、PostgreSQL client tools、object metadata の `--metadata` / `--metadata-set` をサポートする rclone を用意する。
- Workers Freeを維持する。公開routerと14個のservice Workerへ分割し、各Workerの圧縮後uploadを3 MiB未満に保つ。Cron Triggerはrouterの1本に集約する。
- 本番ドメインを Cloudflare の active zone として登録する。Worker 用 hostname と R2 public 用 hostname を決め、切替前に所有確認と DNSSEC 状態を記録する。
- `POSTGRES_URL` は移行元 Supabase Postgres の読み取り可能な接続文字列を設定する。
- `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_ZONE_ID`、`D1_DATABASE_ID` を設定し、`D1_BACKUP_API_TOKEN` はWorker Secretとして登録する。D1 トークンは対象 D1 の read/write 権限だけに絞る。
- `CLOUDFLARE_API_TOKEN` は R2/D1/Worker の作成権限に加えて対象 zone の Cache Rules edit 権限を持つ移行専用 token を設定する。この値は Worker secret へは登録しない。
- rclone に次の remote を設定する。アクセスキーは remote の暗号化設定または CI Secret に保持する。
  - `supabase-storage`: Supabase Storage S3 endpoint。6バケットを読める移行専用キー。
  - `r2-public`: `pg-media-public`。
  - `r2-private`: `pg-media-private`。
  - `r2-backups`: `pg-backups`。
- `NEXT_PUBLIC_MEDIA_BASE_URL` は `pg-media-public` の HTTPS custom domain を指定する。
- ビルド時に `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`、`NEXT_PUBLIC_MEDIA_BASE_URL`、`NEXT_PUBLIC_SITE_URL` に加え、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、`CRON_SECRET` を設定する。秘密値は `env.defaults.json` に置かない。`provision:cloudflare` は同じ値をWorker secretにも同期する。
- `ADMIN_EMAILS` に本番管理者をカンマ区切りで設定する。最終 `migrate:verify` は旧 `profiles.role='admin'` の全メールが含まれない限り失敗する。
- `CRON_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`（LINE Auth Admin専用）、AI/Upstash/VAPID/LINE/XROADの利用中キーをプロセス環境へ設定してから `provision:cloudflare` を実行する。未設定値は警告付きでスキップされる。
- PRプレビューには専用Upstashデータベースを用意し、GitHubの `cloudflare-preview` Environmentへ `PREVIEW_UPSTASH_REDIS_REST_URL`、`PREVIEW_UPSTASH_REDIS_REST_TOKEN`、専用の `PREVIEW_CRON_SECRET` を登録する。ワークフローだけが標準の実行時変数名へ変換し、本番値は共有しない。
- Sentry source map を利用する場合は Releases 作成と source map upload 権限を持つ `SENTRY_AUTH_TOKEN` をビルド環境に設定する。未設定なら source map は生成しない。無効な token を設定したままビルドしない。
- `docs/runbooks/hazard-golden.example.json` を実データの20地点以上で複製・確定する。

## 2. リソース作成と事前検証

```powershell
pnpm install --frozen-lockfile
pnpm provision:cloudflare
pnpm db:migrate:remote
pnpm check:supabase-auth-only
pnpm typecheck
pnpm test:unit
pnpm test:components
pnpm build:cloudflare
pnpm exec wrangler deploy --dry-run
```

`provision:cloudflare` は D1 と4個の R2 bucket を冪等作成し、実 ID を `wrangler.jsonc` に反映する。設定対象は次のとおり。

- D1: `pathguardian`（アプリ本体）、`pathguardian-traffic`（`traffic_accidents` 専用）
- R2: `pg-media-public`、`pg-media-private`、`pg-backups`、`pg-next-cache`
- Images binding: `IMAGES`
- D1長期backup: scoped `D1_BACKUP_API_TOKEN` と `pathguardian-d1-backup` Workflowを設定済み。初回成功とR2 object生成を確認済みで、D1 Time Travelも短期復元手段として併用する。
- Cron Trigger: routerの `*/5 * * * *` 1スケジュール。内部dispatcherが処理ごとの実行間隔を制御する。

`configure:r2-delivery` は Storage 同期後に実行し、public bucket の custom domain（TLS 1.2+）、本番 origin 限定 CORS、Cache Everything（成功応答は edge 1年、browser は object の1年 Cache-Controlを尊重、4xx/5xxは長期保存しない）、`r2.dev` 無効化、private bucket の `hunter-photos/` 97日 Lifecycle 保険を冪等設定する。Lifecycle は実オブジェクトを不可逆に削除するため、保持要件の明示承認を得るまでは `pnpm configure:r2-delivery -- -SkipLifecycle` を使う。zone 未登録のリハーサルに限り、正確な `r2.dev` origin を指定して `-AllowManagedDomain -SkipLifecycle` を使える。

Cloudflare の Preview URL で OAuth callback、LINE callback、private media の所有者／管理者認可、画像アップロード、全 cron の手動起動を確認する。Supabase Auth の許可 redirect URL に Preview URL と最終本番 URLを登録する。

## 3. リハーサル（2回）

リハーサルごとに別の空 D1 または復元可能な検証用 D1 を使う。出力先は毎回変える。

```powershell
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$artifact = "artifacts/migration/rehearsal-$stamp"

pnpm migrate:export:hazards -- --out=$artifact
pnpm migrate:pg-to-d1 -- --out=$artifact --spatial-exported=true
pnpm exec wrangler d1 execute pathguardian --remote --file="$artifact/d1-import.sql"
pnpm migrate:import:hazard-plan -- --plan="$artifact/hazard-import-plan.json"
pnpm migrate:sync:storage -- -Manifest "$artifact/storage-key-map.ndjson" -DryRun
pnpm migrate:sync:storage -- -Manifest "$artifact/storage-key-map.ndjson"
pnpm configure:r2-delivery
pnpm migrate:benchmark:d1
pnpm migrate:verify -- --counts="$artifact/source-counts.json" --storage-manifest="$artifact/storage-key-map.ndjson" --hazard-golden="artifacts/migration/hazard-golden.json"
```

DB 接続文字列を使えない場合、`migrate:pg-to-d1` は `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を使う PostgREST export に自動フォールバックする。この方式は repeatable-read snapshot ではないため、書き込み中はリハーサル専用とし、本番最終 export は手順4の read-only 確認後にだけ実行する。rclone を使えない環境では、参照オブジェクトの同期を `pnpm migrate:sync:storage:wrangler -- --manifest="$artifact/storage-key-map.ndjson"` で代替できる。

2回とも、全テーブル件数、`danger_reports` のソート済み ID SHA-256、Storage sample、hazard golden が一致することを切替判定記録へ残す。Storage は remote 間で共通hashが取れないobjectだけストリーミングSHA-256へ自動フォールバックする。最終リハーサルでは `--all-storage` も実行する。

## 4. 本番凍結・最終バックアップ

1. 現行本番へ `MAINTENANCE_MODE=read_only` を設定して再デプロイする。
2. POST/PUT/PATCH/DELETE が 503、GET/HEAD が継続することを確認する。
3. cron が同じ 503 で停止することを確認する。
4. Supabase Dashboard の DB 接続数と Storage 更新を確認し、書き込みが止まった時刻を記録する。
5. Supabase Security Advisor を再実行する。少なくとも ERROR を0件にするか、対象オブジェクトへの `anon` / `authenticated` アクセスを廃止する切替 SQL と承認者を記録する。`SECURITY DEFINER` view や RLS 無効 table を、ポリシー影響未確認のまま直接変更しない。
6. 最終バックアップを取得する。

Cloudflare側を切替前にread-onlyで先行配置する場合は `"read_only" | pnpm exec wrangler secret put MAINTENANCE_MODE` を実行する。解除は `pnpm exec wrangler secret delete MAINTENANCE_MODE` とし、解除前に必ず最終検証を完了する。

```powershell
pnpm migrate:backup:postgres
# pg_dump/rcloneを使わず、リンク済みSupabase CLIとWranglerで非公開R2へ退避する場合
pnpm migrate:backup:postgres:supabase-cli
pnpm migrate:backup:storage
# rcloneを使えない環境でSupabase HTTPSから非公開R2へ直接転送する場合
pnpm migrate:backup:storage:wrangler
```

`pg-backups/postgres-pre-cutover/<UTC時刻>` と `pg-backups/supabase-storage-pre-cutover/<UTC時刻>` にバックアップが存在し、ローカル receipt の SHA-256／prefix と一致することを確認する。ここを満たさない場合は先へ進まない。

## 5. 最終移行・照合

```powershell
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$artifact = "artifacts/migration/production-$stamp"

pnpm migrate:export:hazards -- --out=$artifact
pnpm migrate:pg-to-d1 -- --out=$artifact --spatial-exported=true
pnpm db:migrate:remote
pnpm exec wrangler d1 execute pathguardian --remote --file="$artifact/d1-import.sql"
pnpm migrate:import:hazard-plan -- --plan="$artifact/hazard-import-plan.json"
pnpm migrate:sync:storage -- -Manifest "$artifact/storage-key-map.ndjson"
pnpm configure:r2-delivery
pnpm migrate:benchmark:d1
pnpm migrate:verify -- --counts="$artifact/source-counts.json" --storage-manifest="$artifact/storage-key-map.ndjson" --all-storage --hazard-golden="artifacts/migration/hazard-golden.json"
```

照合失敗時は DNS を変更しない。原因を修正し、D1 import、hazard plan、Storage sync は同じ artifact から再実行する。Storage 同期は公開 object に `Cache-Control: public, max-age=31536000, immutable` と `Content-Disposition: inline` を上書きし、照合は object metadata に加えて custom domain の実レスポンスと CORS も検証する。`migrate:benchmark:d1` は本番 D1 の東京23区 bbox 10,000行を20回計測し、D1 SQL duration の p95 が300ms未満でなければ失敗する。対象データが10,000行に満たない場合に限り、実データで10,000行を含む bbox を明示指定する。

## 6. デプロイと切替

```powershell
pnpm check:supabase-auth-only
pnpm typecheck
pnpm test:unit
pnpm test:components
pnpm build:cloudflare
pnpm exec wrangler deploy --dry-run
pnpm deploy:cloudflare
```

1. Worker の Preview URL で smoke test を行う。
2. Supabase Auth の Site URL と Redirect URL allowlist を確定した本番 Worker hostname に更新し、OAuth callback を再確認する。
3. custom domain を Worker へ向ける。R2 public custom domain と CSP／Next Image の `NEXT_PUBLIC_MEDIA_BASE_URL` が一致することを確認する。
4. `MAINTENANCE_MODE` を未設定にした Cloudflare Worker version をデプロイする。
5. 認証、危険報告 CRUD、非公開画像、ルート、通知、Safety Quest、管理画面を確認する。
6. dispatcher経由の各cron処理の最初の実行結果とD1長期backupの成功、`pg-backups/d1/YYYY-MM-DD.sql.gz` の生成を確認する。成功するまではD1 backup用scoped tokenを未設定のまま本番完了としない。
7. 24時間は Supabase DB/Storage を削除せず読み取り専用で保持する。

## 7. ロールバック

切替後に重大障害が出た場合は、移行後の D1/R2 へ追加書き込みがあるため、単純な DNS 差し戻しだけではデータが分岐する。

1. Cloudflare Worker を `MAINTENANCE_MODE=read_only` にして新規書き込みを停止する。
2. DNS を凍結済みの旧デプロイへ戻す。旧側も read-only のままにする。
3. D1 Time Travel の bookmark と `pg-backups/d1/*.sql.gz`、R2 の object version／バックアップを保全する。
4. 切替後に生じた書き込みを D1 export から抽出して Postgres/R2 へ逆移送するか、修正版 Cloudflare へ再適用する方針を決める。
5. 整合性を確認してから、採用側だけ read-only を解除する。

「旧側を即時 writable に戻す」操作は禁止する。データ分岐を避けるため、復旧判断と逆移送が完了するまでは必ず両側を read-only に保つ。

## 8. 完了条件

- `pnpm check:supabase-auth-only` が成功する。
- 型チェック、unit/component test、OpenNext build、15 WorkerすべてのWrangler deploy dry-runが成功し、各Workerの圧縮後uploadが3 MiB未満である。
- D1 件数、危険報告 ID hash、全 Storage、hazard golden が一致する。
- Supabase の利用は Auth API と Auth Admin（LINE連携）だけである。
- Supabase Auth の Site URL／Redirect URL allowlist が本番 hostname と一致し、Security Advisor の ERROR が0件または承認済みの隔離手順で外部到達不能である。
- D1日次backup、router dispatcher経由のcron処理、R2 cleanup／hunter retentionが本番で成功している。
- ロールバック用 Postgres/Storage backup と切替判定記録が `pg-backups` に保存されている。
