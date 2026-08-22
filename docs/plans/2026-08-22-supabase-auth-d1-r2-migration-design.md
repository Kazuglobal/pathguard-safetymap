# Supabase Auth 継続 + Cloudflare D1 / R2 移行 詳細設計

- 作成日: 2026-08-22
- 対象: PathGuardian(mapsefe/20250615)
- ステータス: 設計(実装未着手)
- 前提調査: コードベース全体の棚卸し(本書 §2)。Cloudflare の制限値は 2026-08-22 時点の公式ドキュメントを参照。
- 改訂: 2026-08-22 敵対的レビュー(4視点×反証、CONFIRMED 17 / PLAUSIBLE 10)を反映 — JWKS ローカル検証を撤回し `getUser()` 継続、管理者判定を `isAdminUser()` に一本化、`analyze-hazard` Edge Function の移植先を明記、`/leaderboard`・`notifications`・`report_shares` の認可規則を追加、private メディアの認可/キー検証を定義、hunter 写真の保持を DB 連動 cron へ、凍結中の cron 停止を追加、bbox 上限 10,000 維持、数値・行番号の訂正。

---

## 0. 結論(先に読む)

| 項目 | 決定 |
|---|---|
| 認証 | **Supabase Auth を継続**(Google OAuth / LINE カスタム / パスワード / PKCE コールバック / `@supabase/ssr` Cookie セッション / サーバ側 `getUser()` 検証はそのまま) |
| DB | Postgres(Supabase) → **Cloudflare D1**(SQLite)。アクセス層を `lib/db/` に新設し、ORM は **Drizzle**(`drizzle-orm/d1`、テストは `better-sqlite3`) |
| 画像 | Supabase Storage(6 バケット) → **R2 2 バケット**(`pg-media-public` / `pg-media-private`)。DB には URL ではなく **オブジェクトキー**を保存 |
| ホスティング | **Next.js を Cloudflare Workers へ移す(`@opennextjs/cloudflare`)**。D1/R2 は Workers バインディング直結。Vercel 継続案(§4.2 案B)は代替として残す |
| PostGIS | D1 に空間拡張は無い。**bbox 列 + インデックスで粗選別 → `@turf/*` で厳密判定**(§6) |
| RLS | D1 に RLS は無い。**212 ポリシーを `lib/db/authz/` のアプリ層認可へ移植**し、認可マトリクステストで担保(§7) |
| 切替方式 | デュアルライトはしない。**リハーサル 2 回 → 書き込み凍結(メンテ) → 一括移行 → 検証 → 切替**。ロールバックは環境変数の戻しのみ(§10) |

移行の最大リスクは「D1 の性能」ではなく、(1) PostGIS 依存 RPC 5 本の再実装、(2) RLS 212 本のアプリ層化、(3) DB に焼き込まれた Supabase 公開 URL の書き換え、の 3 点。すべて本書で設計済み。

---

## 1. 現状アーキテクチャ(棚卸し結果)

### 1.1 数字

| 観点 | 値 |
|---|---|
| マイグレーション SQL | 62 ファイル / 約 6,340 行 |
| RLS 有効テーブル | 37 テーブル / `CREATE POLICY` 212 本 |
| ランタイムコードが参照する関係 | **30 テーブル + 4 ビュー**(`app/` 42 / `lib/` 54 / `hooks/` 42 / `components/` 15 箇所 ≒ 154 箇所。`scripts/` 含め ≒ 195) |
| RPC(TS から呼ぶもの) | 14 本(うち PostGIS 依存 5 本、SECURITY DEFINER 7 本) |
| Realtime | **0**(`subscribe()` は全て `onAuthStateChange` / Push API) |
| Edge Function | 1 本(`supabase/functions/analyze-hazard/`) |
| Storage バケット | 6(`images`, `danger-reports`(private), `processed-images`, `avatars`, `hazard-simulations`(public), `hunter-photos`(private)) |
| `.storage.from()` 呼び出し | ランタイム 11 ファイル(`app/lib/hooks/components`)。うち **クライアント直アップロード 2**、クライアント直削除 3 |
| 拡張 | `postgis` のみ(pg_cron / pgvector / pg_net 無し) |
| cron | Vercel Cron 5 本(`vercel.json`) |
| ホスティング | Vercel。`wrangler`/`open-next` 設定は未導入 |

### 1.2 DB 呼び出しの主な経路

- **サーバ**: `lib/supabase-server.ts`(Cookie 束縛 anon)、`lib/supabase-admin.ts`(service role)
- **ブラウザ**: `lib/supabase-client.ts` / `components/providers/supabase-provider.tsx`。`hooks/*` と一部 `components/*` から **ブラウザが直接テーブルを読み書き**している(`use-danger-reports.ts`, `use-user-routes.ts`, `use-report-interactions.ts` 等)
- **ミドルウェア**: `middleware.ts` が `auth.getUser()` でセッション更新 + 14 プレフィックスの保護

ブラウザ直アクセスは RLS が防波堤になっている。D1 では**ブラウザから DB に触れない**ので、この経路は全て Route Handler / Server Action 経由に変わる(§5.3)。

### 1.3 PostGIS 依存(再実装必須)

| RPC | 定義 | 使う関数 | 呼び出し元 |
|---|---|---|---|
| `get_accidents_in_bbox` | `20260501130000_extend_accident_heatmap_to_2024.sql` | `&& ST_MakeEnvelope` | `lib/traffic-accident-heatmap.ts:180` |
| `get_nearby_accident_stats` | `20260719070354_...sql` | `ST_DWithin(geography)` | `lib/traffic-accident-data.ts:211`, `lib/traffic-accident/server.ts:53` |
| `get_route_hazard_intersections` | `20260307193000_...sql:97` | `ST_GeomFromGeoJSON/ST_Intersects/ST_Intersection/ST_ClosestPoint` | `app/api/hazard/route-risks/route.ts:52` |
| `get_hazard_zones_at_point` | `20260719120000_...sql:60` | `ST_Intersects/ST_DWithin` | `lib/hazard-zone-gate.ts:202` |
| `has_hazard_zone_coverage_at_point` | 同上 `:127` | `ST_Intersects` | `lib/hazard-zone-gate.ts:208` |

geometry 列: `traffic_accidents.location`(Point)、`hazard_zones.geom` / `hazard_zone_coverage.coverage_geom`(MultiPolygon)、`danger_spots.location`、`hub_events/hub_features.geom`(後者 3 つはコード未参照)。

### 1.4 Storage の現状と問題点

- `danger_reports.image_url / processed_image_url / processed_image_urls[]`, `profiles.avatar_url`, `report_images.image_url`, `hazard_image_cache.public_url` に **Supabase の完全公開 URL** が保存されている
- Supabase URL を path に戻すパーサが **3 重複**(`lib/storage-path.ts:10`, `lib/danger-report-image-access.ts:28`, `app/api/safety-quest/challenges/route.ts:17`)
- `danger-reports` は `20260704090300` で private 化されたが、署名 URL 化は未完(当該 SQL のヘッダに明記)
- `components/admin/ProcessImageDialog.tsx:78,97` は `processed_images`(アンダースコア)を指しており、定義上のバケット `processed-images` と不一致(現状バグの疑い)
- 唯一のサーバ側画像処理は `app/api/image/process/route.ts:30-57` の `sharp`(EXIF/GPS 除去を兼ねる)。**Workers では sharp は動かない**(§8.3)

---

## 2. 移行対象の範囲

### 2.1 移行する(30 テーブル + 4 ビュー相当)

`danger_reports`, `danger_report_moderation_log`, `danger_report_reactions`, `profiles`, `notifications`, `report_comments`, `report_likes`, `report_bookmarks`, `report_shares`, `report_flags`, `report_images`, `user_routes`, `route_learning_sessions`, `user_points`, `user_badges`, `badges`, `missions`, `user_mission_progress`, `safety_quest_attempts`, `hunter_photos`, `hazard_detections`, `hunter_audit_log`, `hazard_zones`, `hazard_zone_coverage`, `hazard_image_cache`, `image_generation_gate_log`, `push_subscriptions`, `local_safety_alerts`, `api_usage_logs`, `api_budget_settings`, `traffic_accidents`(RPC 経由のみ)

ビュー 4 本(`danger_reports_public_preview`, `report_stats`, `public_reports_with_stats`, `danger_category_stats`)は **4 本とも SQLite の VIEW で再定義**する(`danger_reports_public_preview` は `round(latitude,2)` / `round(longitude,2)` で 0.01° 丸め、列は現行ビューと同一)。D1 には RLS が無いので「owner ビューで RLS を迂回する」構造自体が不要になり、anon 向け読み出しは `danger-reports.repo.listPublicPreview(actor)` がこの VIEW を読むだけにする(丸めロジックを TS と SQL に分散させない)。

### 2.2 移行せず破棄(コード未参照)

`danger_spots`, `comments`, `spot_photos`, `spot_disaster_types`, `disaster_types`, `hazard_categories`, `ai_recommendations`, `ai_simulations`, `vlm_hazard_analyses`, `diaries`, `diary_comments`, `players`, `teams`, `hub_events`, `hub_features`, `hub_sources`, `rate_limit_log`, `report_notifications`, `hazard_game_sessions`, `address_prefectures`, `address_municipalities`, `safety_quest_challenges`, `safety_quest_rewards`, `safety_quest_user_rewards`, `user_report_activity`, `traffic_accident_summary`

破棄前に **pg_dump を R2 の専用バケット `pg-backups`(メディア配信ルートから到達不能)に保存**(§10.1)。`danger_reports` の FK(`address_municipalities`, `address_prefectures`)は D1 では FK を張らず文字列列として残す。

### 2.3 Supabase に残すもの

- Auth(users, identities, sessions, OAuth 設定, JWT 署名鍵)
- `supabase/functions/analyze-hazard` は **`app/api/vlm/analyze-hazard/route.ts` へ移植して廃止**。これは危険報告フォームの VLM 解析パネル(`components/danger-report/danger-report-form.tsx` → `hooks/use-vlm-analysis.ts` → `lib/vlm-analysis.ts:369` の `supabase.functions.invoke("analyze-hazard")`)が現役で使う経路で、**同等ルートは存在しない**(`app/api/hazard-game/analyze` はきけんハンター専用 AI で流用禁止)。移植時は `VlmAnalysisResponse`(`lib/vlm-analysis.ts:81`)のレスポンス形を維持し、`lib/vlm-analysis.ts` の呼び出しを `fetch` に置換、所有者チェック(`danger_reports.user_id = actor.id`)とレート制限(現行はインメモリ → Upstash)を Route Handler 側で再実装する

---

## 3. 目標アーキテクチャ

```
Browser ──(Cookie: sb-*)──▶ Next.js on Cloudflare Workers (OpenNext)
                                │  ├─ middleware: 現行どおり supabase.auth.getUser() でセッション検証
                                │  ├─ Route Handlers / Server Actions
                                │  │     └─ lib/db (Drizzle) ──▶ D1 binding (DB)
                                │  │     └─ lib/media          ──▶ R2 binding (MEDIA_PUBLIC / MEDIA_PRIVATE)
                                │  │     └─ lib/images         ──▶ Images binding (sharp 代替)
                                │  └─ scheduled(): Cron Triggers 5 本
                                │
                                ├──▶ Supabase Auth (signIn / OAuth / refresh / admin.updateUserById)
                                ├──▶ Upstash Redis(レート制限。現状維持。将来 KV/Rate Limiting へ)
                                └──▶ Gemini / OpenAI / Mapbox / web-push(現状維持)

media.<domain> (R2 custom domain, public bucket, Cache Everything)
/api/media/private/<key> (Worker が認可してから R2 からストリーム)
```

---

## 4. ホスティング判断

### 4.1 案A(採用): Next.js を Cloudflare Workers へ(`@opennextjs/cloudflare`)

- D1 は Workers バインディングからの利用が本来形。HTTP API(`/accounts/.../d1/.../query`)は管理用で **1,200 req / 5 分**のレート制限があり、アプリのデータパスには使えない
- OpenNext は Next.js 16 全マイナーをサポート(公式)。Node ランタイムで動作。**Node Middleware(15.2+)は未サポート**だが本リポの `middleware.ts` は通常ミドルウェアなので影響なし
- cron は Cron Triggers、レート制限は当面 Upstash 継続

**事前確認(Phase 0 スパイク)で必ず潰す項目**

| # | 確認 | 不合格時の手当 |
|---|---|---|
| P0-1 | `npx opennextjs-cloudflare build` が通る(Sentry ラッパ `withSentryConfig` / `transpilePackages` 込み) | Sentry を `@sentry/cloudflare` に差し替え |
| P0-2 | Worker スクリプトサイズ(gzip 10MB 上限) | `cesium`/`three`/`mapbox-gl` はクライアントのみなので通常問題なし。超過時は dynamic import を徹底 |
| P0-3 | `sharp` 依存 1 箇所(`app/api/image/process/route.ts`) | Images binding へ置換(§8.3) |
| P0-4 | 既存依存 `web-push` / `openai` / `@anthropic-ai/sdk` / `@supabase/ssr` が `nodejs_compat` で動く(新規依存は `drizzle-orm` / `better-sqlite3`(dev) のみ。`jose` は使わない、§7.1) | 不可なら fetch ベース実装へ |
| P0-5 | ISR/キャッシュ: `next/cache` 用に R2 incremental cache を設定 | — |
| P0-6 | `maxDuration=180` の画像生成ルート(`/api/hazard/image`)が Workers の CPU 時間制限(有料 30s CPU / 壁時計は長め)に収まる | Gemini 待ちは I/O なので CPU は小さい。超過時は Workflows/Queues へ |

### 4.2 案B(代替): Vercel 継続 + Cloudflare Worker "Data API"

Vercel 上の Next.js → HTTPS → Hono Worker(D1/R2 バインディング) という 2 段構成。Supabase JWT をそのまま Worker に転送して検証。
- 長所: Vercel の運用(Cron/Preview/Sentry)をそのまま維持、OpenNext 互換リスクが無い
- 短所: 往復 1 ホップ増(地理的に Vercel 東京 → CF 東京なら数 ms)、Worker と Next の 2 デプロイ、型共有が必要
- **§5 のリポジトリ層を Worker 側に置けば案A→案Bの切替は `lib/db/client.ts` の実装差し替えのみ**。P0 スパイクが不合格なら案Bへ倒す

---

## 5. DB 設計(D1)

### 5.1 型マッピング規約

| Postgres | SQLite(D1) | 規約 |
|---|---|---|
| `uuid` | `TEXT` | アプリで `crypto.randomUUID()`。`auth.users` 参照列も TEXT、FK は張らない |
| `timestamptz` | `TEXT`(ISO-8601 UTC `2026-08-22T01:02:03.456Z`) | 比較は文字列順で成立。`DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))` |
| `jsonb` | `TEXT`(JSON) | `json_valid()` CHECK。SQLite の `json_extract` で条件検索可 |
| `text[]` | `TEXT`(JSON 配列) | `processed_image_urls`, `evacuation_points` |
| `boolean` | `INTEGER`(0/1) | Drizzle `integer({ mode: 'boolean' })` |
| `numeric(6,2)` / `double precision` / `real` | `REAL` | 金額系は無い |
| `geometry(Point)` | `lat REAL, lng REAL` | §6 |
| `geometry(MultiPolygon)` | `geojson TEXT` + `bbox_min_lng/min_lat/max_lng/max_lat REAL` | §6。1 行 2MB 上限に注意 |
| enum(`geocode_provider`, `share_platform`, `local_safety_alert_type`) | `TEXT` + `CHECK (col IN (...))` | |
| `BRIN` index | 通常 B-tree | `image_generation_gate_log.created_at` |
| partial index | SQLite も `WHERE` 付き index 可 | そのまま |
| `COUNT(*) FILTER (WHERE ...)` | `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` | `get_nearby_accident_stats` |
| `jsonb_object_agg` | アプリ側で集計 | 同上 |
| トリガ `updated_at` | Drizzle スキーマの `$onUpdate(() => nowIso())` で一元化(リポジトリの手書きセットに依存しない。SQLite トリガとの二重管理も避ける) | |
| `protect_danger_report_moderation_fields` トリガ | リポジトリの `updateDangerReport()` が **moderation 列を受け付けない型**にし、`moderationRepo` だけが更新可能(§7.3) | |

### 5.2 スキーマ(Drizzle、代表テーブル)

`lib/db/schema/*.ts` にドメイン別(`reports.ts`, `social.ts`, `gamification.ts`, `routes.ts`, `hazard.ts`, `hunter.ts`, `push.ts`, `ops.ts`)で分割。各 200〜400 行。

```ts
// lib/db/schema/reports.ts(抜粋)
export const dangerReports = sqliteTable('danger_reports', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dangerType: text('danger_type').notNull(),
  dangerLevel: integer('danger_level').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  status: text('status', { enum: ['pending','approved','rejected','resolved','published'] }).notNull().default('pending'),
  imageKey: text('image_key'),                      // 旧 image_url(URL→キー)
  processedImageKeys: text('processed_image_keys', { mode: 'json' }).$type<string[]>().notNull().default([]),
  accidentStats: text('accident_stats', { mode: 'json' }),
  accidentRiskScore: real('accident_risk_score'),
  geocodeSource: text('geocode_source'), geocodeConfidence: real('geocode_confidence'), geocodedAt: text('geocoded_at'),
  addressHash: text('address_hash'), prefecture: text('prefecture'), prefectureCode: text('prefecture_code'),
  city: text('city'), municipalityCode: text('municipality_code'), town: text('town'), postalCode: text('postal_code'),
  alertRadiusM: integer('alert_radius_m'),
  pushNotifiedAt: text('push_notified_at'),
  aiModerationStatus: text('ai_moderation_status'), aiModerationReason: text('ai_moderation_reason'),
  aiModerationScore: real('ai_moderation_score'), aiModerationCheckedAt: text('ai_moderation_checked_at'),
  createdAt: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).$onUpdate(() => nowIso()),
}, (t) => [
  index('idx_dr_user').on(t.userId),
  index('idx_dr_status_created').on(t.status, t.createdAt),
  index('idx_dr_lat_lng').on(t.latitude, t.longitude),           // bbox 検索
  index('idx_dr_push').on(t.pushNotifiedAt, t.createdAt),
  index('idx_dr_moderation_sweep').on(t.aiModerationStatus, t.status, t.createdAt),
  check('dr_lat_range', sql`${t.latitude} BETWEEN -90 AND 90`),
  check('dr_lng_range', sql`${t.longitude} BETWEEN -180 AND 180`),
]);
```

インデックスは現行 Postgres の定義を 1:1 で持ち込む(§1 調査で列挙済み)。`UNIQUE` も同様:
`danger_report_reactions(user_id, report_id, reaction_type)`, `push_subscriptions(user_id, endpoint)`, `local_safety_alerts(prefecture, city, occurred_at)`, `route_learning_sessions(user_id, route_id, session_id)`, `hazard_image_cache(hazard_type, risk_level, area_context, scenario_key, provider, prompt_signature)`, `report_likes/report_bookmarks(user_id, report_id)`, `hazard_zone_coverage(hazard_type, region_label, source_layer)`。

### 5.3 アクセス層(リポジトリ)

```
lib/db/
  client.ts        getDb(): Drizzle<D1>。OpenNext では getCloudflareContext().env.DB、vitest では better-sqlite3
  schema/*.ts
  authz/*.ts       §7
  repos/
    danger-reports.repo.ts   list(bbox/filters) / getById / create / update / delete / claimForPush / moderationCas
    social.repo.ts           likes / bookmarks / comments / reactions / flags
    routes.repo.ts           user_routes / route_learning_sessions
    gamification.repo.ts     incrementPoints(トランザクション) / badges / missions
    hazard.repo.ts           zones / coverage / image_cache / gate_log(+ §6 の空間関数)
    accidents.repo.ts        accidentsInBbox / nearbyStats(§6)
    hunter.repo.ts, push.repo.ts, ops.repo.ts, profiles.repo.ts
  migrations/      drizzle-kit generate → wrangler d1 migrations apply
```

- **全リポジトリ関数の第 1 引数は `Actor`**(`{ kind: 'anon' } | { kind: 'user', id, email, isAdmin } | { kind: 'service' }`)。RLS の代替(§7)
- **ブラウザ直アクセスの置換**: `hooks/use-*.ts` 42 箇所 + `components/*` 15 箇所(§1.1 と同じ実測)と、Server Component からの直アクセス(`app/leaderboard/page.tsx`, `app/badges/page.tsx`, `app/mypage/page.tsx` 等 `app/**/page.tsx` 内の `.from(`)は、`app/api/**` の Route Handler(または Server Action)を叩く fetch に置き換える。`hooks/` の公開インターフェース(戻り値・state 名)は維持し、characterization テスト(`tests/unit/hooks/*`)で固定してから差し替える
- 14 RPC の対応:

| RPC | 置換 |
|---|---|
| `get_accidents_in_bbox` | `accidents.repo.accidentsInBbox()`(§6.1) |
| `get_nearby_accident_stats` | `accidents.repo.nearbyStats()`(§6.2) |
| `get_route_hazard_intersections` | `hazard.repo.routeIntersections()`(§6.3) |
| `get_hazard_zones_at_point` / `has_hazard_zone_coverage_at_point` | `hazard.repo.zonesAtPoint()` / `hasCoverageAtPoint()`(§6.4) |
| `get_danger_reports_for_moderation_sweep` | `danger-reports.repo.listForModerationSweep()`(service 限定) |
| `set_danger_report_image` | `danger-reports.repo.setImages()`(単一 UPDATE、moderation 再オープン込み) |
| `increment_user_points` | `gamification.repo.incrementPoints()`(`db.batch([...])` で原子化) |
| `toggle_report_like` / `toggle_report_bookmark` | `social.repo.toggleLike/Bookmark()`(INSERT OR IGNORE → 0 行なら DELETE) |
| `get_report_comments` / `get_trending_reports` / `get_user_bookmarked_reports` | 同名の repo 関数(JOIN は Drizzle で記述) |
| `exec_sql` | **廃止**(`scripts/apply-migration.ts` は `wrangler d1 migrations apply` に置換) |

### 5.4 D1 制限への当て込み

| D1 制限(有料) | 本リポでの当たり | 対策 |
|---|---|---|
| DB 10GB | `traffic_accidents` が最大。geometry→lat/lng で縮む | 移行時に `pg_total_relation_size` を取り確認 |
| 1 行 2MB | `hazard_zones.geojson`(MultiPolygon) | §6.3 で分割/簡略化。超過行は import 時に fail-fast |
| バインドパラメータ 100 / クエリ | `.in('id', userIds)`(`lib/admin-reports-service.ts:37`)、`.in('report_id', ids)`(`use-landing-report-reactions.ts`)、hazard_zones bulk insert | リポジトリ層で **50 件チャンク**に分割するヘルパ `chunkedIn()` |
| ステートメント 100KB | bulk insert(`hazard-zone-import.ts:310`, `hunter/analyze.ts:89`) | `db.batch()` + 行数チャンク |
| 1 invocation あたり 1,000 クエリ | cron のループ(`web-push.ts:113` の range ページング等) | ページサイズ見直し、1 実行の上限を明示 |
| クエリ 30 秒 / 単一スレッド | `get_accidents_in_bbox` の 10,000 行 | **上限 10,000 は維持**(§11 の禁止手段)。`(source_year, lat, lng)` 索引で Phase 0 の目標(10,000 件 p95 < 300ms)に届かない場合のみ geohash 列(§6.1)を追加し、それでも不足なら §13 で上限変更を決裁する。JSON 組み立ては JS 側 |
| Time Travel 30 日 | バックアップ | 加えて日次 `wrangler d1 export` を R2 `pg-backups` へ(Cron Trigger) |

---

## 6. 空間クエリの再実装(PostGIS 代替)

原則: **D1 で bbox 粗選別 → JS(既存依存 `@turf/turf@^7.2.0` からの named import。個別 `@turf/*` パッケージは追加しない)で厳密判定**。

### 6.1 `accidentsInBbox`(ヒートマップ)

```sql
SELECT id, lat, lng, severity_code, involves_child, involves_pedestrian, source_year, party_a_age, party_b_age, ...
FROM traffic_accidents
WHERE lat BETWEEN ?minLat AND ?maxLat AND lng BETWEEN ?minLng AND ?maxLng
  AND source_year BETWEEN ?minYear AND ?maxYear
  [AND severity_code IN (...)] [AND involves_child = 1] [AND young 判定列] [AND involves_pedestrian = 1]
LIMIT ?limit
```
- インデックス: `(source_year, lat, lng)` と `(involves_child, source_year, lat, lng)`。現行の `idx_traffic_accidents_*` 相当
- 子ども/若年フィルタの `party_*_age` 判定は現行 SQL をそのまま `CASE`/`IN` に移す(`20260501130000_...sql` のロジックが正)
- GeoJSON FeatureCollection の組み立ては JS。現行の `abortSignal` + `p_limit` 縮小リトライ(`traffic-accident-heatmap.ts`)はそのまま活かす
- 任意最適化: `geohash6 TEXT` 列を持ち `geohash6 IN (...)` で広域を切る(bbox index で不足したときのみ)

### 6.2 `nearbyStats`(半径 200m 等)

1. 半径 r から緯度経度のデルタを計算した bbox で粗選別(上の索引を流用)
2. JS で haversine(`@turf/distance`)により `≤ r` に絞る
3. 集計(年別・重症度別・child/pedestrian 件数)は JS で `reduce`。現行戻り値の JSON 形(`jsonb_build_object`)を **同一キーで再現**し、`lib/traffic-accident-data.ts` の呼び出し側は無変更

### 6.3 `routeIntersections`(経路 × 浸水/津波ポリゴン)

- 保存形: `hazard_zones` は **MultiPolygon を Polygon 単位に分割して 1 行ずつ**保存(`zone_group_id` で元 ID を保持)。各行に `geojson TEXT`(Polygon)+ `bbox_*` 4 列。import 時に `JSON.stringify(geojson).length > 1_500_000` なら `@turf/simplify`(tolerance 段階的)で縮小、なお超過なら import を失敗させる(静かに落とさない)
- クエリ: 経路の bbox と `bbox_*` が重なる行のみ取得
  `WHERE bbox_min_lng <= ?maxLng AND bbox_max_lng >= ?minLng AND bbox_min_lat <= ?maxLat AND bbox_max_lat >= ?minLat [AND hazard_type = ?]`
  インデックス `(hazard_type, bbox_min_lng, bbox_max_lng)`
- JS: `@turf/boolean-intersects` で交差判定 → `@turf/line-intersect` + `@turf/boolean-point-in-polygon` で交差区間を求め → 代表点は `@turf/nearest-point-on-line`(ST_ClosestPoint 相当)→ `zone_group_id` で重複排除。戻り値の列(`depth_label`, `area_label`, `title`, `summary`, `explanation`, `evacuation_points[]`, `longitude`, `latitude`, `scenario_key`)は現行 RPC と同一
- 件数保険: 取得行が 500 を超えたら `LIMIT` で打ち切り、レスポンスに `truncated: true` を返す

### 6.4 `zonesAtPoint` / `hasCoverageAtPoint`

- 点の bbox(tolerance_m を度に換算して拡張)で粗選別 → `booleanPointInPolygon`、tolerance>0 なら `@turf/point-to-line-distance` で境界距離 ≤ tolerance も許容
- 現行の日本 bbox ガード(lng 122–154 / lat 20–46)は維持
- `hazard_zone_coverage` も同じ保存形・同じ手順

### 6.5 検証

- 移行前に Postgres で **代表入力 200 件の RPC 結果をスナップショット**(bbox 50 / 近傍 50 / 経路 50 / 点 50)→ D1 実装と突合するゴールデンテスト(`tests/unit/db/spatial-parity.test.ts`)。座標は 1e-6、件数は完全一致、距離は ±1m 許容

---

## 7. 認可(RLS の代替)

### 7.1 方針

- D1 にはロールも RLS も無い。**すべての DB アクセスは Workers 内**なので、Postgres で「誰が・どの行を」と書いていた 212 本を、`lib/db/authz/` の純関数へ移す
- `Actor` の生成は `lib/auth/actor.ts` 一箇所: **現行どおり `@supabase/ssr` の `supabase.auth.getUser()`**(サーバ側検証。サインアウト/BAN/削除が即時反映される)の結果から `{ id, email, isAdmin: isAdminUser(user) }` を作る。JWKS ローカル検証・`jose`・署名鍵の ES256 移行は**採用しない**(失効が最大 1 時間遅れる回帰になり、Cookie のチャンク/base64 形式の展開も自前で持つことになる。D1 移行で Auth の検証経路は変える必要がない)。`getUser()` の往復は Route Handler 1 回につき 1 回に限定し、リクエストスコープでメモ化する
- 管理者判定は **`isAdminUser()`(`lib/admin.ts`、`ADMIN_EMAILS` 由来)の 1 本に統一**する。現行は 3 系統に分かれている: (a) `ADMIN_EMAILS`、(b) `app/api/image/process/route.ts:154` の `app_metadata.role === 'admin'`(service role でしか書けないが第 2 の昇格経路)、(c) `profiles.role = 'admin'` — RLS だけでなく **アプリ層でも使用**(`lib/danger-report-moderation-handler.ts:123` の非所有者審査の許可判定、`lib/danger-report-moderation-monitoring.ts:75` / `lib/danger-report-moderation-service.ts:152` の管理者通知宛先)。移行では (b) を削除し、(c) の 3 箇所は `ADMIN_EMAILS` → `profiles` を email で引く形に置換する。`profiles.role` 列は表示用に残すが認可には使わない
  - 回帰防止: §10.1 で **`profiles.role='admin'` のユーザー一覧と `ADMIN_EMAILS` を突合**し、差分があればカットオーバー前に `ADMIN_EMAILS` へ追加する(追加しない判断も明示的に行う)

### 7.2 ポリシー → ルール表(抜粋。全テーブル分を `lib/db/authz/matrix.ts` に定数化)

| テーブル | select | insert | update | delete |
|---|---|---|---|---|
| `danger_reports` | anon: `listPublicPreview` のみ(丸め座標)。user: `status ∈ PUBLIC` or 自分。admin/service: 全件 | user: `user_id = self`。status は**サーバが決める**(user → `pending`、admin → 任意。`20260704090000` と同等)。現行クライアントの「`published` で INSERT → 42501/23514 なら `pending` で再試行」(`lib/danger-report-status.ts`)はサーバ判定に置換して廃止 | user: 自分の行、moderation/status 列は不可。admin: status 可。service: 全列 | user: 自分。admin: 全件 |
| `profiles` | user: 全件の表示列(display_name/avatar)、自分は全列 | 自分(role は 'user' 固定) | 自分(role 変更不可 `20260704090100`) | 不可 |
| `report_likes` / `report_bookmarks` / `danger_report_reactions` / `report_flags` | 自分(+ 集計は件数のみ) | `user_id = self` | — | 自分 |
| `report_comments` | 公開レポートの全件 | `user_id = self` | 自分 | 自分/admin |
| `user_routes` / `route_learning_sessions` / `push_subscriptions` / `user_badges` / `user_mission_progress` / `safety_quest_attempts` | 自分 | 自分 | 自分 | 自分 |
| `user_points` | 自分(全列)。加えて **`listLeaderboard()`: 認証済み全員が `user_id, points, level, display_name` の上位 50 件**を読める(`/leaderboard` 用。現行 RLS は自分限定で `app/leaderboard/page.tsx:24-28` は潜在バグ — 移行で明示的に直す) | service | service | — |
| `notifications` | 自分(`user_id = self`) | user: `user_id` は任意だが **`type` と `report_id` の組が許可リスト内**(現行 `20260203131028:177-189` の条件を移植。ルート報告通知 `hooks/use-danger-report-submit.ts:153` の他ユーザー宛 INSERT を許す) | 自分(`is_read` のみ) | 自分 |
| `report_shares` | 自分 | `user_id = self` または null(匿名共有、現行 `:127-131`) | — | — |
| `hunter_photos` / `hazard_detections` / `hunter_audit_log` | `player_id = self` | self | — | self |
| `hazard_zones` / `hazard_zone_coverage` / `hazard_image_cache` / `badges` / `missions` / `local_safety_alerts` | 認証済み全員(`local_safety_alerts` は anon 可) | service | service | service |
| `image_generation_gate_log` / `api_usage_logs` / `api_budget_settings` / `danger_report_moderation_log` | admin/service | service | service(`api_budget_settings` は admin 可) | — |

### 7.3 実装形

```ts
// lib/db/authz/guard.ts
export function assertCan(actor: Actor, action: Action, table: Table, row?: RowLike): void  // 失敗は AuthzError(403)
// lib/db/repos/*.ts は冒頭で assertCan() を呼び、select 系は scopeFor(actor) で WHERE を付与する
```

- `service` Actor を作れるのは `app/api/cron/**`(`CRON_SECRET` 検証後)と `lib/danger-report-moderation-*`、`lib/push-notifications/*` のみ。`getServiceActor()` を `server-only` モジュールに置く
- **認可マトリクステスト** `tests/unit/db/authz-matrix.test.ts`: 表 7.2 の全セル × {anon, other user, owner, admin, service} を better-sqlite3 で実行し、期待通り 403/行数制限になることを検証。現行 `supabase/tests/danger_report_ai_moderation_rls.sql` の内容はここへ移植

---

## 8. メディア(R2)設計

### 8.1 バケットとキー

| R2 バケット | 旧バケット → プレフィックス | 公開方法 |
|---|---|---|
| `pg-media-public` | `avatars/`, `hazard-simulations/`, `processed-images/`, `images/` | カスタムドメイン `media.<domain>`、Cache Rule: Cache Everything / 1 年、`Content-Disposition: inline` |
| `pg-media-private` | `danger-reports/`, `hunter-photos/` | `GET /api/media/private/<key>` を Worker が認可してストリーム(**配信経路はこの 1 本のみ**。署名 URL は作らない)。認可規則: `danger-reports/{owner}/{reportId}/...` は **レポートの状態で判定**(`danger_reports.status ∈ PUBLIC` なら認証済み全員、`pending/rejected` は所有者と admin/service のみ — 現行の `storage.objects SELECT TO authenticated` + クイズ配信 `safety-quest/challenges` + 他人の報告表示 `route-danger-report-dialog.tsx` を壊さない)。`hunter-photos/{userId}/...` は所有者のみ。キー検証: 1 回だけ `decodeURIComponent` → 許可プレフィックス(`danger-reports/`, `hunter-photos/`)のホワイトリスト → セグメント数固定 → `..`・先頭 `/`・制御文字を拒否。`Cache-Control: private, max-age=300` |

キー規約は現行 path をそのまま継承(所有者 ID を第 1 セグメントに置く慣習が認可の鍵になる):
- `danger-reports/{ownerUserId}/{reportId}/{file}`、`hunter-photos/{userId}/{photoId}/masked.webp`、`avatars/{userId}/{ts}.{ext}`(現行はルート直置きなので移行時に `{userId}/` 配下へ寄せる)、`hazard-simulations/{userId}/{...}`

### 8.2 DB には **キーのみ**保存

- `danger_reports.image_url → image_key`、`processed_image_url(単数) → processed_image_key`(`lib/ar-image-utils.ts:94`, `safety-quest/challenges` が読むため残す)、`processed_image_urls → processed_image_keys(JSON)`、`profiles.avatar_url → avatar_key`、`report_images.image_url → image_key`、`hazard_image_cache.public_url` 削除(`storage_path` を `object_key` に改名)
- URL 生成は `lib/media/url.ts` の `publicMediaUrl(key)` / `privateMediaUrl(key)` **のみ**。3 重複していた Supabase URL パーサ(§1.4)は移行スクリプトに残して本体から削除
- 読み出し互換: 移行直後に残る旧 URL を含む行が無いよう、移行 SQL で **全件をキーに書き換える**(§10.3)。コード側に「URL ならそのまま返す」フォールバックは置かない(混在状態を温存しないため)

### 8.3 アップロード経路の統一(Workers では全てサーバ経由)

| 現行 | 移行後 |
|---|---|
| `/api/image/process`(sharp で再エンコード+EXIF 除去 → `danger-reports`) | 同ルート。`sharp` → **Images binding**(`env.IMAGES.input(stream).transform({ rotate: auto }).output({ format: 'image/webp', quality: 85 })`)。Images 出力は EXIF を保持しないので GPS 除去要件を満たす。**破損画像は 400**(現行どおり、黙って素通しさせない) |
| `/api/hazard/image`(Gemini → `hazard-simulations`) | 同ルート。`r2.put(key, bytes, { httpMetadata: { contentType } })` |
| `/api/hunter/analyze`(webp 限定 → `hunter-photos`) | 同ルート。webp 限定ガードは維持 |
| `profile-edit-dialog.tsx:144` クライアント直アップロード(avatars) | 新設 `POST /api/profile/avatar`(multipart、5MB、jpeg/png/gif/webp、Images で 512px 正方形化) |
| `ProcessImageDialog.tsx:78,97` クライアント直アップロード(`processed_images`) | 新設 `POST /api/admin/reports/{id}/processed-image`(admin 限定)。バケット名不一致バグはここで解消 |
| クライアント直削除 3 箇所(`mypage/page.tsx:299`, `use-delete-danger-report.ts:91`, `report-admin-image-upload.tsx:168`) | `DELETE /api/reports/{id}` 内で DB 行削除 → R2 削除を **同一ハンドラ**で実行(失敗は Sentry に記録し、孤児キーは日次 cron で掃除) |
| 署名 URL(`lib/danger-report-image-access.ts`, `safety-quest/challenges`, `hunter/storage.ts`) | `/api/media/private/<key>` 経由に統一。`useDangerReportSignedImageUrl(s)` は **フック名・戻り値の契約(未取得/欠損時 `null`)を維持**したまま、内部を「キー → `/api/media/private/<key>` の同期変換」に差し替える(10 箇所の呼び出し側のプレースホルダ分岐を壊さない)。`lib/types.ts` の `DangerReport.image_url` 型は `image_key` へ改名し、消費側 16 ファイル超は Phase 4 の置換対象として `tsc` で洗い出す |

### 8.4 配信・CORS・CSP

- `next.config.mjs` `images.remotePatterns` に `media.<domain>` を追加し、Supabase ホスト(ハードコードのフォールバック含む)を削除
- `lib/content-security-policy.mjs` の `img-src` / `connect-src` に `media.<domain>` を追加
- R2 public バケット CORS: `GET` / `Origin: https://<app-domain>` / `Access-Control-Allow-Origin` を返す(html2canvas の `crossOrigin='anonymous'`(`lib/report-generation/report-sections.ts:158`)が必要とする)
- private 経路も同ハンドラで CORS ヘッダを返す

### 8.5 ライフサイクル

- `hunter-photos/` の 90 日保持は **`hunter_photos.retention_until` を基準にした日次 cron が DB 行(+ `hazard_detections`)と R2 オブジェクトを同時に削除**する(R2 Lifecycle だけだと行が残り、たんけんノートの一覧(`app/api/hunter/photos/route.ts:30`)が 404 画像を並べる)。Lifecycle は `retention_until + 7 日` の保険としてのみ設定
- `danger-reports/` は削除ハンドラ + 孤児掃除 cron(DB に無いキーを週 1 で削除。削除前に対象一覧をログ出力)

---

## 9. cron / 周辺サービス

| 現行(Vercel Cron) | 移行後(Cron Triggers → OpenNext の `scheduled` ハンドラ → 既存 `/api/cron/*` を内部 fetch) |
|---|---|
| `push-danger-reports */15` / `moderation-sweep */5` / `local-alert-fetcher 0 */3` / `local-safety-alerts 0 */2` / `daily-news-digest 30 22` | `wrangler.jsonc` の `triggers.crons` に同スケジュール。`CRON_SECRET` ヘッダ検証は現行 `lib/cron-auth.ts` を流用 |
| 新規 | `0 18 * * *` D1 export → R2 `pg-backups/d1/YYYY-MM-DD.sql.gz`、`0 19 * * 0` R2 孤児掃除 |

- claim-and-release パターン(`notify-danger-report.ts:51-107`、`notify-local-alert.ts`)は `UPDATE ... WHERE push_notified_at IS NULL RETURNING id` が SQLite 3.35+ で使えるので同形で移植
- 楽観 CAS(`danger-report-moderation-service.ts:276-321`)も `UPDATE ... WHERE ... ` + `changes()` 判定で同形
- Upstash レート制限: 継続(fetch ベースなので Workers で動く)。将来的に Workers Rate Limiting binding へ
- Sentry: `@sentry/cloudflare` + Next 向けクライアント SDK(P0-1 の結果で決定)
- LINE ログイン(`app/api/auth/line/callback`): Supabase Admin API(`auth.admin.updateUserById`)を使うだけなので無変更

---

## 10. データ移行手順

### 10.1 事前

1. `pg_dump --schema-only` / `--data-only` を取得し R2 `pg-backups/pre-migration/` へ保存(破棄テーブル含む全量)
2. Supabase Storage → R2: Supabase の **S3 互換エンドポイント**から `rclone sync` で 6 バケットを §8.1 のプレフィックスへ(リハーサル時に初回フル、切替時に差分)。件数・バイト数・サンプル MD5 を突合
3. `profiles.role='admin'` と `ADMIN_EMAILS` の突合(§7.1)

### 10.2 変換スクリプト `scripts/migrate/pg-to-d1.ts`

- Postgres から直接読み(`pg` ライブラリ)、§5.1 の規約で変換し、`INSERT` を **50 行 / 文、100KB 未満**のチャンクで `.sql` 出力 → `wrangler d1 execute --remote --file`(5GB 上限内)
- geometry は `ST_AsGeoJSON` で読み、Point→lat/lng、MultiPolygon→Polygon 分割 + bbox 計算(§6.3)
- 画像列は `extractStoragePathFromPublicUrl()`(旧パーサをここに移設)で **URL→キー**に変換。パース失敗は件数を出して停止(黙って NULL にしない)
- 出力先の行数チェック: テーブルごとに `SELECT count(*)` を Postgres / D1 で突合、`danger_reports` は `id` のハッシュ合計も突合
- 空間ゴールデン(§6.5)をこの段階で実行

### 10.3 切替(メンテナンスウィンドウ、目安 60 分)

1. `MAINTENANCE_MODE=read_only` を有効化(ミドルウェアで書き込み系ルートを 503 + 画面バナー)。**同時に Vercel Cron 5 本を停止**(`lib/cron-auth.ts` が `MAINTENANCE_MODE` 時に 503 を返す + Vercel 側で cron を無効化)。service Actor の書き込み(push_notified_at / moderation / local_safety_alerts)が凍結中に Postgres を更新すると D1 と食い違うため
2. 差分 `rclone sync`、`pg-to-d1` 再実行(全量。D1 は一度空にして入れ直す方が差分適用より確実)
3. 検証スクリプト `scripts/migrate/verify.ts`(行数 / ハッシュ / 空間ゴールデン / 画像キー 100 件のサンプル HEAD)
4. Workers 側デプロイに切替(DNS / Vercel 側は残したまま)
5. スモーク(ログイン → 地図 → 投稿 → 画像表示 → いいね → cron 手動起動)
6. `MAINTENANCE_MODE` 解除

### 10.4 ロールバック

- 切替後 72 時間は Vercel + Supabase を凍結維持(書き込み凍結中のデータは Postgres にも存在する)
- 戻す場合: DNS を Vercel へ戻し、凍結解除。D1 側で発生した書き込みは `wrangler d1 export` で回収して手動適用(72 時間以内なら量は限定的)
- 72 時間後に Supabase DB / Storage を縮退(DB は Free 相当に落とし 30 日保持 → 削除)

---

## 11. コード変更の全体像と順序

| Phase | 内容 | 完了条件 |
|---|---|---|
| 0 スパイク(1 週) | OpenNext ビルド、Images binding で sharp 代替の PoC、D1 に `traffic_accidents` を入れて bbox 性能測定 | P0-1〜6 が全て緑。性能: 東京 23 区 bbox **10,000 件**(現行上限)が p95 < 300ms |
| 1 基盤(1 週) | `wrangler.jsonc`、`lib/db/{client,schema,authz}`、Drizzle マイグレーション、vitest の better-sqlite3 ハーネス、`lib/auth/actor.ts`(`getUser()` ベース) | 認可マトリクステスト緑、`tsc --noEmit` 0 |
| 2 リポジトリ化(2 週) | 30 テーブルのリポジトリ + 14 RPC の置換 + 空間関数(§6)+ ゴールデンテスト | `tests/unit/db/**` 緑、既存 API ルートテスト(`tests/unit/app/api/**`)のモックを `lib/db` 向けに移植して緑 |
| 3 ブラウザ直アクセス撤去(1.5 週) | `hooks/*` 42 箇所 + `components/*` 15 箇所 → Route Handler 経由。`supabase-client.ts` の利用は **Auth 系のみ**に縮退(lint ルールで `.from(` をブラウザ側で禁止) | `hooks` characterization テスト緑、`grep "supabase.*\.from(" hooks components` が 0 |
| 4 メディア(1 週) | `lib/media/*`、`/api/media/private`、アップロード 2 経路の新設、削除経路統合、CSP/remotePatterns | R2 を使う E2E(Playwright)で投稿→表示→削除が通る |
| 5 cron / 周辺(0.5 週) | Cron Triggers、バックアップ cron、Sentry | 手動トリガで 5 本全てが成功ログ |
| 6 移行リハーサル ×2 → 本番切替(1 週) | §10 | verify.ts 全緑、スモーク合格 |

合計目安 8 週(1 名換算)。Phase 2/3/4 は独立性が高いので並列化可能。

禁止手段(契約):
- 認可をリポジトリ層の外(ハンドラ個別)に散らさない
- 旧 URL 互換フォールバックを本体コードに残さない
- `exec_sql` 相当の任意 SQL RPC を作らない
- 性能不足を `LIMIT` 縮小や timeout 延長だけで隠さない(索引/保存形で直す)

---

## 12. 環境変数(キー名のみ)

| 追加 | 用途 |
|---|---|
| (binding) `DB`, `MEDIA_PUBLIC`, `MEDIA_PRIVATE`, `IMAGES`, `NEXT_INC_CACHE_R2_BUCKET` | `wrangler.jsonc` |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | `https://media.<domain>` |
| `MAINTENANCE_MODE` | 切替時のみ |
| **削除** `SUPABASE_SERVICE_ROLE_KEY` の DB 用途 | Auth Admin API(LINE 連携)でのみ引き続き使用。DB/Storage 用途は消える |

`scripts/validate-env.js` の必須リストを更新。`.env*` の値は本書・ログに載せない。

---

## 13. 未決事項(着手前に確定)

1. **案A/案B の最終判断** — Phase 0 の P0-1〜6 の結果で決める。既定は案A
2. `traffic_accidents` の行数・サイズ(D1 10GB / 性能目標の根拠)— Phase 0 で実測
3. `hazard_zones` の実データ投入状況(メモリ `hazard-zone-gated-image-design` では「実データ未投入」)。未投入なら §6.3 の分割は import スクリプト側だけで済む
4. `avatars` のキーを `{userId}/` 配下へ寄せるか(現行はバケット直下)— 寄せる(認可の一貫性のため)を既定とする
5. Upstash を Workers Rate Limiting に置き換える時期 — 本移行のスコープ外

---

## 付録 A. 参照した制限値(2026-08-22 公式ドキュメント)

- D1: DB 10GB(有料)/ 行・文字列 2MB / バインド 100 / 文 100KB / 1 invocation 1,000 クエリ / クエリ 30 秒 / 列 100 / Time Travel 30 日 / `d1 execute` 5GB
- R2: 単一 PUT 5GiB、オブジェクト 5TiB、同一キー書き込み 1/s、バケット管理 50/s、REST API 1,200 req/5 分(データパスに使わない)
- OpenNext for Cloudflare: Next.js 16 全マイナー対応、Node Middleware(15.2+)非対応
- Supabase Auth: JWKS `/auth/v1/.well-known/jwks.json` と ES256 鍵は利用可能だが本設計では不採用(§7.1)
