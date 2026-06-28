-- =============================================
-- きけんハンター Phase 1: 写真ストレージ & 検出結果 & 監査ログ
-- 設計書: docs/plans/2026-06-26-kiken-hunter-design.md (Phase 1 確定コントラクト)
--
-- 目的:
--   子ども(未成年)の通学路写真を「マスク済み・EXIF除去済み」で安全に保存する。
--   所有者(player_id = auth.uid())以外はDB行にもストレージオブジェクトにもアクセスできない。
--   未マスク画像・公開URLは扱わない(非公開バケット + 短TTL署名URLのみ)。
--
-- 注意: このファイルはマイグレーション定義のみ。**ライブ適用は別途**(supabase db push / MCP)で行う。
--       冪等性に配慮(IF NOT EXISTS / on conflict / drop policy if exists → create policy)。
-- =============================================

begin;

-- ---------------------------------------------
-- 1. テーブル定義
-- ---------------------------------------------

-- 撮影された(マスク済み)写真のメタデータ。実体は非公開ストレージに置き、ここには image_path のみ保持。
create table if not exists public.hunter_photos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,                       -- = auth.uid() (所有者)
  image_path text not null,                      -- ストレージオブジェクトパス {uid}/{photoId}/masked.webp
  pin_lat double precision,
  pin_lng double precision,
  captured_at timestamptz,
  exif_stripped boolean default true,            -- EXIF除去済みフラグ(既定 true を前提に保存)
  masked boolean default true,                   -- マスク済みフラグ(既定 true を前提に保存)
  retention_until timestamptz,                   -- 保持期限(これ以降は削除対象)
  created_at timestamptz default now()
);

-- 写真に対するAIハザード検出結果。写真削除時に連動削除。
create table if not exists public.hazard_detections (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references public.hunter_photos(id) on delete cascade,
  type text,
  region jsonb,
  severity text,
  kid_explanation text,
  safe_action text,
  confidence real,
  model text,
  created_at timestamptz default now()
);

-- 監査ログ(誰が・何を・どの対象に)。best-effort で書き込む。
create table if not exists public.hunter_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text,
  target_id text,
  created_at timestamptz default now()
);

-- ---------------------------------------------
-- 2. RLS 有効化
-- ---------------------------------------------

alter table public.hunter_photos enable row level security;
alter table public.hazard_detections enable row level security;
alter table public.hunter_audit_log enable row level security;

-- 最小権限の付与(RLSで行レベルに絞り込む)。
grant select, insert, update, delete on public.hunter_photos to authenticated;
grant select, insert, delete on public.hazard_detections to authenticated;
grant select, insert on public.hunter_audit_log to authenticated;
grant all on public.hunter_photos, public.hazard_detections, public.hunter_audit_log to service_role;

-- ---------------------------------------------
-- 3. RLS ポリシー: hunter_photos (所有者スコープ)
-- ---------------------------------------------

drop policy if exists "hunter_photos_select_own" on public.hunter_photos;
create policy "hunter_photos_select_own"
  on public.hunter_photos
  for select
  to authenticated
  using (player_id = (select auth.uid()));

drop policy if exists "hunter_photos_insert_own" on public.hunter_photos;
create policy "hunter_photos_insert_own"
  on public.hunter_photos
  for insert
  to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "hunter_photos_update_own" on public.hunter_photos;
create policy "hunter_photos_update_own"
  on public.hunter_photos
  for update
  to authenticated
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

drop policy if exists "hunter_photos_delete_own" on public.hunter_photos;
create policy "hunter_photos_delete_own"
  on public.hunter_photos
  for delete
  to authenticated
  using (player_id = (select auth.uid()));

-- service_role はアプリ層で所有者検証する前提でフルアクセス。
drop policy if exists "hunter_photos_service_role_all" on public.hunter_photos;
create policy "hunter_photos_service_role_all"
  on public.hunter_photos
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------
-- 4. RLS ポリシー: hazard_detections
--    所属する hunter_photos の player_id = auth.uid() を EXISTS で確認。
-- ---------------------------------------------

drop policy if exists "hazard_detections_select_own" on public.hazard_detections;
create policy "hazard_detections_select_own"
  on public.hazard_detections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.hunter_photos p
      where p.id = hazard_detections.photo_id
        and p.player_id = (select auth.uid())
    )
  );

drop policy if exists "hazard_detections_insert_own" on public.hazard_detections;
create policy "hazard_detections_insert_own"
  on public.hazard_detections
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.hunter_photos p
      where p.id = hazard_detections.photo_id
        and p.player_id = (select auth.uid())
    )
  );

drop policy if exists "hazard_detections_delete_own" on public.hazard_detections;
create policy "hazard_detections_delete_own"
  on public.hazard_detections
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.hunter_photos p
      where p.id = hazard_detections.photo_id
        and p.player_id = (select auth.uid())
    )
  );

drop policy if exists "hazard_detections_service_role_all" on public.hazard_detections;
create policy "hazard_detections_service_role_all"
  on public.hazard_detections
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------
-- 5. RLS ポリシー: hunter_audit_log
--    insert は actor_id = auth.uid()、select は actor_id = auth.uid()。
-- ---------------------------------------------

drop policy if exists "hunter_audit_log_select_own" on public.hunter_audit_log;
create policy "hunter_audit_log_select_own"
  on public.hunter_audit_log
  for select
  to authenticated
  using (actor_id = (select auth.uid()));

drop policy if exists "hunter_audit_log_insert_own" on public.hunter_audit_log;
create policy "hunter_audit_log_insert_own"
  on public.hunter_audit_log
  for insert
  to authenticated
  with check (actor_id = (select auth.uid()));

drop policy if exists "hunter_audit_log_service_role_all" on public.hunter_audit_log;
create policy "hunter_audit_log_service_role_all"
  on public.hunter_audit_log
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------
-- 6. 非公開ストレージバケット
-- ---------------------------------------------

insert into storage.buckets (id, name, public)
values ('hunter-photos', 'hunter-photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------
-- 7. storage.objects RLS ポリシー (所有者スコープ)
--    bucket_id = 'hunter-photos' かつ パス先頭フォルダ = auth.uid()::text。
--    オブジェクトパス: {auth.uid()}/{photoId}/masked.webp
-- ---------------------------------------------

drop policy if exists "hunter_photos_objects_select_own" on storage.objects;
create policy "hunter_photos_objects_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'hunter-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "hunter_photos_objects_insert_own" on storage.objects;
create policy "hunter_photos_objects_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'hunter-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "hunter_photos_objects_update_own" on storage.objects;
create policy "hunter_photos_objects_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'hunter-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'hunter-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "hunter_photos_objects_delete_own" on storage.objects;
create policy "hunter_photos_objects_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'hunter-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------
-- 8. インデックス
-- ---------------------------------------------

create index if not exists hunter_photos_player_id_idx
  on public.hunter_photos (player_id);

create index if not exists hazard_detections_photo_id_idx
  on public.hazard_detections (photo_id);

commit;
