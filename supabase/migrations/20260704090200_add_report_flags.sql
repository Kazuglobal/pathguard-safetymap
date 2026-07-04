-- 危険箇所レポートへの通報(abuse report)機能
-- ユーザーが不適切だと感じたレポートを通報できるようにする。
-- 通報はレポート自体の公開状態を変更せず、管理者が確認するための記録として保存する。

begin;

create table if not exists public.report_flags (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_report_id uuid not null references public.danger_reports(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists report_flags_target_report_id_idx
  on public.report_flags (target_report_id);

create index if not exists report_flags_reporter_user_id_idx
  on public.report_flags (reporter_user_id);

alter table public.report_flags enable row level security;

-- 認証ユーザーは自分の reporter_user_id = auth.uid() でのみ通報を INSERT できる。
drop policy if exists "report_flags_insert" on public.report_flags;
create policy "report_flags_insert"
  on public.report_flags
  for insert
  to authenticated
  with check ((select auth.uid()) = reporter_user_id);

-- SELECT は管理者のみ（一般ユーザーは他人の通報内容を閲覧できない）。
drop policy if exists "report_flags_select_admin" on public.report_flags;
create policy "report_flags_select_admin"
  on public.report_flags
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

commit;
