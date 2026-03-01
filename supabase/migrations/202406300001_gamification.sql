-- ユーザー累計ポイント
create table if not exists public.user_points (
  user_id uuid references auth.users(id) primary key,
  points integer default 0 not null,
  level integer default 1 not null,
  updated_at timestamptz default now()
);
-- バッジ定義
create table if not exists public.badges (
  id serial primary key,
  name text not null,
  icon text,            -- 例: 'trophy', 'star' など Lucide 名称や URL
  threshold integer,     -- 条件ポイント
  created_at timestamptz default now()
);
-- ユーザー取得バッジ
create table if not exists public.user_badges (
  user_id uuid references auth.users(id) on delete cascade,
  badge_id integer references public.badges(id) on delete cascade,
  acquired_at timestamptz default now(),
  primary key (user_id, badge_id)
);
-- ミッション定義
create table if not exists public.missions (
  id serial primary key,
  title text not null,
  description text,
  target_type text,   -- 'report', 'visit' など
  target_value integer,
  created_at timestamptz default now()
);
-- ユーザーミッション進捗
create table if not exists public.user_mission_progress (
  user_id uuid references auth.users(id) on delete cascade,
  mission_id integer references public.missions(id) on delete cascade,
  progress integer default 0,
  completed boolean default false,
  updated_at timestamptz default now(),
  primary key (user_id, mission_id)
);
-- RLS を有効化
alter table public.user_points enable row level security;
alter table public.user_badges enable row level security;
alter table public.user_mission_progress enable row level security;
-- 認証ユーザーは自分の行のみ選択・挿入・更新
create policy "self_access_points" on public.user_points for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "self_access_badges" on public.user_badges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "self_access_progress" on public.user_mission_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
