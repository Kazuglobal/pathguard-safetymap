-- Route learning sessions for parent-child AR learning mode.
-- Stores v2 checklist / quiz results after local IndexedDB completion.

begin;

create table if not exists public.route_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route_id uuid not null references public.user_routes(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 1 and 64),
  child_id text check (child_id is null or child_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  child_name text check (child_name is null or char_length(child_name) <= 40),
  schema_version smallint not null default 1,
  started_at timestamptz not null default now(),
  completed_at timestamptz check (completed_at is null or completed_at >= started_at),
  reviewed_count integer not null default 0 check (reviewed_count >= 0),
  saved_count integer not null default 0 check (saved_count >= 0),
  quiz_score integer not null default 0 check (quiz_score >= 0),
  quiz_total integer not null default 0 check (quiz_total between 0 and 3),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  stop_results jsonb not null default '[]'::jsonb check (jsonb_typeof(stop_results) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_learning_sessions_quiz_score_le_total check (quiz_score <= quiz_total),
  constraint route_learning_sessions_user_route_session_key unique (user_id, route_id, session_id)
);

create index if not exists route_learning_sessions_user_route_started_idx
  on public.route_learning_sessions (user_id, route_id, started_at desc);

create index if not exists route_learning_sessions_route_id_idx
  on public.route_learning_sessions (route_id);

alter table public.route_learning_sessions enable row level security;

drop policy if exists "route_learning_sessions_select" on public.route_learning_sessions;
create policy "route_learning_sessions_select"
  on public.route_learning_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "route_learning_sessions_insert" on public.route_learning_sessions;
create policy "route_learning_sessions_insert"
  on public.route_learning_sessions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_routes r
      where r.id = route_id
        and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "route_learning_sessions_update" on public.route_learning_sessions;
create policy "route_learning_sessions_update"
  on public.route_learning_sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_routes r
      where r.id = route_id
        and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "route_learning_sessions_delete" on public.route_learning_sessions;
create policy "route_learning_sessions_delete"
  on public.route_learning_sessions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
