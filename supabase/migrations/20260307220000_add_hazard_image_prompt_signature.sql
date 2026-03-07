alter table public.hazard_image_cache
  add column if not exists prompt_signature text;

alter table public.hazard_image_cache
  alter column prompt_signature set default '';

update public.hazard_image_cache
set prompt_signature = md5(prompt_en)
where prompt_signature is null or prompt_signature = '';

alter table public.hazard_image_cache
  alter column prompt_signature set not null;

do $$
declare
  coarse_constraint_name text;
begin
  select con.conname
  into coarse_constraint_name
  from pg_constraint con
  where con.conrelid = 'public.hazard_image_cache'::regclass
    and con.contype = 'u'
    and pg_get_constraintdef(con.oid) ilike
      'unique (hazard_type, risk_level, area_context, scenario_key, provider)';

  if coarse_constraint_name is not null then
    execute format(
      'alter table public.hazard_image_cache drop constraint %I',
      coarse_constraint_name
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.hazard_image_cache'::regclass
      and conname = 'hazard_image_cache_lookup_key'
  ) then
    alter table public.hazard_image_cache
      add constraint hazard_image_cache_lookup_key
      unique (
        hazard_type,
        risk_level,
        area_context,
        scenario_key,
        provider,
        prompt_signature
      );
  end if;
end $$;
