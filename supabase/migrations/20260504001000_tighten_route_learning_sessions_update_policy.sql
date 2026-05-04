-- Tighten route learning session updates so route_id cannot be changed to another user's route.

begin;

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

commit;
