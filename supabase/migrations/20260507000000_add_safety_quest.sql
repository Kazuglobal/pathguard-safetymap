-- Safety Quest v1 game state.
-- Keeps child-facing game data away from exact route coordinates.

begin;

create table if not exists public.safety_quest_challenges (
  id text primary key,
  source_type text not null check (source_type in ('report', 'sample', 'private')),
  report_id uuid references public.danger_reports(id) on delete set null,
  title text not null check (char_length(title) <= 120),
  image_url text not null,
  thumbnail_url text,
  area_label text not null check (char_length(area_label) <= 80),
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'hard')),
  status text not null default 'active' check (status in ('active', 'locked', 'retired')),
  ai_result jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_result) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists safety_quest_challenges_status_source_idx
  on public.safety_quest_challenges (status, source_type, created_at desc);

create index if not exists safety_quest_challenges_report_id_idx
  on public.safety_quest_challenges (report_id)
  where report_id is not null;

create table if not exists public.safety_quest_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text,
  mode text not null check (mode in ('hazard', 'quiz-battle', 'private-practice')),
  user_markers jsonb not null default '[]'::jsonb check (jsonb_typeof(user_markers) = 'array'),
  answer_payload jsonb,
  score integer not null default 0 check (score between 0 and 100),
  accuracy integer not null default 0 check (accuracy between 0 and 100),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  points_awarded integer not null default 0 check (points_awarded between 0 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists safety_quest_attempts_user_created_idx
  on public.safety_quest_attempts (user_id, created_at desc);

create index if not exists safety_quest_attempts_challenge_idx
  on public.safety_quest_attempts (challenge_id);

create table if not exists public.safety_quest_rewards (
  id uuid primary key default gen_random_uuid(),
  reward_key text not null unique check (reward_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  reward_type text not null check (reward_type in ('hero', 'badge', 'item', 'route', 'avatar')),
  name text not null check (char_length(name) <= 80),
  rarity text not null default 'normal' check (rarity in ('normal', 'rare', 'super_rare')),
  asset_url text,
  unlock_condition jsonb not null default '{}'::jsonb check (jsonb_typeof(unlock_condition) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.safety_quest_user_rewards (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.safety_quest_rewards(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  acquired_at timestamptz not null default now(),
  primary key (user_id, reward_id)
);

create index if not exists safety_quest_user_rewards_user_acquired_idx
  on public.safety_quest_user_rewards (user_id, acquired_at desc);

alter table public.safety_quest_challenges enable row level security;
alter table public.safety_quest_attempts enable row level security;
alter table public.safety_quest_rewards enable row level security;
alter table public.safety_quest_user_rewards enable row level security;

grant select on public.safety_quest_challenges to authenticated, service_role;
grant select, insert on public.safety_quest_attempts to authenticated, service_role;
grant update, delete on public.safety_quest_attempts to service_role;
grant select on public.safety_quest_rewards to authenticated, service_role;
grant select on public.safety_quest_user_rewards to authenticated, service_role;
grant insert, update, delete on public.safety_quest_user_rewards to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "safety_quest_challenges_select_active" on public.safety_quest_challenges;
create policy "safety_quest_challenges_select_active"
  on public.safety_quest_challenges
  for select
  to authenticated
  using (status = 'active' and source_type <> 'private');

drop policy if exists "safety_quest_challenges_service_role_all" on public.safety_quest_challenges;
create policy "safety_quest_challenges_service_role_all"
  on public.safety_quest_challenges
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "safety_quest_attempts_select_own" on public.safety_quest_attempts;
create policy "safety_quest_attempts_select_own"
  on public.safety_quest_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "safety_quest_attempts_insert_own" on public.safety_quest_attempts;
create policy "safety_quest_attempts_insert_own"
  on public.safety_quest_attempts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "safety_quest_attempts_service_role_all" on public.safety_quest_attempts;
create policy "safety_quest_attempts_service_role_all"
  on public.safety_quest_attempts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "safety_quest_rewards_select" on public.safety_quest_rewards;
create policy "safety_quest_rewards_select"
  on public.safety_quest_rewards
  for select
  to authenticated
  using (true);

drop policy if exists "safety_quest_rewards_service_role_all" on public.safety_quest_rewards;
create policy "safety_quest_rewards_service_role_all"
  on public.safety_quest_rewards
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "safety_quest_user_rewards_select_own" on public.safety_quest_user_rewards;
create policy "safety_quest_user_rewards_select_own"
  on public.safety_quest_user_rewards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "safety_quest_user_rewards_service_role_all" on public.safety_quest_user_rewards;
create policy "safety_quest_user_rewards_service_role_all"
  on public.safety_quest_user_rewards
  for all
  to service_role
  using (true)
  with check (true);

insert into public.safety_quest_rewards (reward_key, reward_type, name, rarity, unlock_condition)
values
  ('lookout-master', 'badge', '見通し名人', 'rare', '{"accuracy_gte": 60}'::jsonb),
  ('guardian-whistle', 'item', '見守りホイッスル', 'normal', '{"clear_stage": true}'::jsonb),
  ('mamorun-cap', 'avatar', 'まもるんキャップ', 'normal', '{"first_clear": true}'::jsonb)
on conflict (reward_key) do nothing;

commit;
