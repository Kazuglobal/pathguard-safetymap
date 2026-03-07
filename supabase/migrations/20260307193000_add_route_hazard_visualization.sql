create extension if not exists postgis;

create table if not exists public.hazard_zones (
  id uuid primary key default gen_random_uuid(),
  hazard_type text not null check (hazard_type in ('flood', 'tsunami')),
  source_layer text not null,
  risk_level integer not null check (risk_level between 1 and 5),
  depth_min_m numeric(6,2),
  depth_max_m numeric(6,2),
  area_context text not null check (area_context in ('residential-school-route', 'riverside', 'coastal')),
  properties jsonb not null default '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hazard_zones_geom_gist
  on public.hazard_zones using gist (geom);

create index if not exists hazard_zones_lookup_idx
  on public.hazard_zones (hazard_type, risk_level, area_context);

alter table public.hazard_zones enable row level security;

drop policy if exists "hazard_zones_select_authenticated" on public.hazard_zones;
create policy "hazard_zones_select_authenticated"
  on public.hazard_zones
  for select
  to authenticated
  using (true);

create table if not exists public.hazard_image_cache (
  id uuid primary key default gen_random_uuid(),
  hazard_type text not null check (hazard_type in ('flood', 'tsunami')),
  risk_level integer not null check (risk_level between 1 and 5),
  area_context text not null check (area_context in ('residential-school-route', 'riverside', 'coastal')),
  scenario_key text not null,
  provider text not null default 'gemini',
  depth_label text not null,
  prompt_en text not null,
  storage_path text not null,
  public_url text not null,
  status text not null default 'ready',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hazard_type, risk_level, area_context, scenario_key, provider)
);

alter table public.hazard_image_cache enable row level security;

drop policy if exists "hazard_image_cache_select_authenticated" on public.hazard_image_cache;
create policy "hazard_image_cache_select_authenticated"
  on public.hazard_image_cache
  for select
  to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'hazard-simulations',
  'hazard-simulations',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
where not exists (
  select 1 from storage.buckets where id = 'hazard-simulations'
);

drop policy if exists "hazard_simulations_select_public" on storage.objects;
create policy "hazard_simulations_select_public"
  on storage.objects
  for select
  to public
  using (bucket_id = 'hazard-simulations');

create or replace function public.set_hazard_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_hazard_zones_updated_at on public.hazard_zones;
create trigger set_hazard_zones_updated_at
before update on public.hazard_zones
for each row execute function public.set_hazard_updated_at();

drop trigger if exists set_hazard_image_cache_updated_at on public.hazard_image_cache;
create trigger set_hazard_image_cache_updated_at
before update on public.hazard_image_cache
for each row execute function public.set_hazard_updated_at();

create or replace function public.get_route_hazard_intersections(
  p_route_geometry jsonb
)
returns table (
  id uuid,
  hazard_type text,
  source_layer text,
  risk_level integer,
  depth_min_m numeric,
  depth_max_m numeric,
  depth_label text,
  area_context text,
  area_label text,
  title text,
  summary text,
  explanation text,
  evacuation_points text[],
  longitude double precision,
  latitude double precision,
  scenario_key text
)
language sql
security invoker
set search_path = public
as $$
with route_input as (
  select st_setsrid(st_geomfromgeojson(p_route_geometry::text), 4326) as geom
),
zone_matches as (
  select
    hz.id,
    hz.hazard_type,
    hz.source_layer,
    hz.risk_level,
    hz.depth_min_m,
    hz.depth_max_m,
    hz.area_context,
    st_closestpoint(st_intersection(hz.geom, route_input.geom), route_input.geom) as point_geom
  from public.hazard_zones hz
  cross join route_input
  where route_input.geom is not null
    and st_intersects(hz.geom, route_input.geom)
),
normalized as (
  select
    id,
    hazard_type,
    source_layer,
    risk_level,
    depth_min_m,
    depth_max_m,
    case
      when depth_min_m is not null and depth_max_m is not null
        then trim(to_char(depth_min_m, 'FM999999990.0')) || 'm〜' || trim(to_char(depth_max_m, 'FM999999990.0')) || 'm'
      when depth_min_m is not null
        then trim(to_char(depth_min_m, 'FM999999990.0')) || 'm以上'
      when depth_max_m is not null
        then trim(to_char(depth_max_m, 'FM999999990.0')) || 'm以下'
      else '深さ情報なし'
    end as depth_label,
    area_context,
    case area_context
      when 'residential-school-route' then '住宅街の通学路'
      when 'riverside' then '河川沿い'
      when 'coastal' then '海岸近く'
      else area_context
    end as area_label,
    case hazard_type
      when 'tsunami' then '津波リスク レベル' || risk_level
      else '洪水リスク レベル' || risk_level
    end as title,
    case hazard_type
      when 'tsunami' then '津波リスク レベル' || risk_level || ' / 想定浸水深' ||
        case
          when depth_min_m is not null and depth_max_m is not null
            then trim(to_char(depth_min_m, 'FM999999990.0')) || 'm〜' || trim(to_char(depth_max_m, 'FM999999990.0')) || 'm'
          when depth_min_m is not null then trim(to_char(depth_min_m, 'FM999999990.0')) || 'm以上'
          when depth_max_m is not null then trim(to_char(depth_max_m, 'FM999999990.0')) || 'm以下'
          else '情報なし'
        end
      else '洪水リスク レベル' || risk_level || ' / 想定浸水深' ||
        case
          when depth_min_m is not null and depth_max_m is not null
            then trim(to_char(depth_min_m, 'FM999999990.0')) || 'm〜' || trim(to_char(depth_max_m, 'FM999999990.0')) || 'm'
          when depth_min_m is not null then trim(to_char(depth_min_m, 'FM999999990.0')) || 'm以上'
          when depth_max_m is not null then trim(to_char(depth_max_m, 'FM999999990.0')) || 'm以下'
          else '情報なし'
        end
    end as summary,
    case hazard_type
      when 'tsunami' then 'この地点では津波による浸水が想定されます。'
      else 'この地点では大雨や河川氾濫時の浸水が想定されます。'
    end as explanation,
    case hazard_type
      when 'tsunami' then array[
        '避難場所と高台への経路を家族で確認しておく',
        '津波警報が出たら海や川から離れてすぐに避難する',
        '近くに高台がなければ高い建物へ垂直避難する'
      ]
      else array[
        '日頃から避難場所を確認しておく',
        '警報が出たら早めに行動する',
        '高い場所や丈夫な建物の上階へ避難する'
      ]
    end as evacuation_points,
    st_x(point_geom) as longitude,
    st_y(point_geom) as latitude,
    case
      when hazard_type = 'tsunami' and area_context = 'coastal' then 'standard-coastal'
      when area_context = 'riverside' then 'standard-riverside'
      when area_context = 'residential-school-route' then 'standard-residential'
      else 'standard-base'
    end as scenario_key
  from zone_matches
  where point_geom is not null
)
select *
from normalized
order by risk_level desc, id;
$$;

revoke all on function public.get_route_hazard_intersections(jsonb) from public;
grant execute on function public.get_route_hazard_intersections(jsonb) to authenticated;
