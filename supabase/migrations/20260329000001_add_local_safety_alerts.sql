create type local_alert_category as enum ('suspicious', 'voice_call', 'following', 'other');

create table if not exists local_safety_alerts (
  id               uuid        primary key default gen_random_uuid(),
  prefecture       text        not null,
  city             text        not null default '',
  category         local_alert_category not null,
  description      text        not null,
  source_url       text,
  occurred_at      timestamptz not null,
  push_notified_at timestamptz,
  created_at       timestamptz not null default now()
);

-- upsert の競合解決キー（city 不明は空文字に正規化して重複を防ぐ）
create unique index if not exists local_safety_alerts_dedup_idx
  on local_safety_alerts (prefecture, city, occurred_at);

-- 発生日時降順の検索用インデックス
create index if not exists local_safety_alerts_occurred_at_idx
  on local_safety_alerts (occurred_at desc);

alter table local_safety_alerts enable row level security;

-- サービスロール (Cron) は全件操作可
create policy "local_safety_alerts_service_role_all" on local_safety_alerts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 認証済みユーザーは読み取り可
create policy "authenticated select" on local_safety_alerts
  for select to authenticated using (true);

-- 未ログインユーザーも読み取り可（ランディングページ用）
create policy "anon select" on local_safety_alerts
  for select to anon using (true);
