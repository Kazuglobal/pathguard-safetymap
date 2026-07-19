CREATE TABLE IF NOT EXISTS public.hazard_zone_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_type text NOT NULL CHECK (hazard_type IN ('flood', 'tsunami')),
  region_label text NOT NULL,
  source text NOT NULL,
  source_layer text NOT NULL,
  coverage_geom geometry(MultiPolygon, 4326) NOT NULL,
  imported_features integer NOT NULL CHECK (imported_features >= 0),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hazard_type, region_label, source_layer)
);

CREATE INDEX IF NOT EXISTS hazard_zone_coverage_geom_gist
  ON public.hazard_zone_coverage USING gist (coverage_geom);

ALTER TABLE public.hazard_zone_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hazard_zone_coverage_select_authenticated"
  ON public.hazard_zone_coverage;
CREATE POLICY "hazard_zone_coverage_select_authenticated"
  ON public.hazard_zone_coverage
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.hazard_zone_coverage
  FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.image_generation_gate_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL CHECK (
    route IN ('hazard-image', 'generate-image', 'generate-prompts')
  ),
  mode text NOT NULL CHECK (mode IN ('log', 'enforce')),
  situation text,
  verdict text NOT NULL CHECK (
    verdict IN ('inside', 'outside', 'no_coverage', 'unavailable')
  ),
  zone_id uuid,
  lat_rounded numeric(6,3),
  lng_rounded numeric(6,3),
  user_id uuid,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_generation_gate_log_created_at_brin
  ON public.image_generation_gate_log USING brin (created_at);

ALTER TABLE public.image_generation_gate_log ENABLE ROW LEVEL SECURITY;

-- No client policy is intentional: service_role writes append-only audit rows.
REVOKE ALL ON TABLE public.image_generation_gate_log FROM anon, authenticated;

-- ST_DWithin below casts the zone to geography. Index the same expression so
-- the 30 metre marker tolerance remains index-backed at nationwide scale.
CREATE INDEX IF NOT EXISTS hazard_zones_geography_gist
  ON public.hazard_zones USING gist ((geom::geography));

CREATE OR REPLACE FUNCTION public.get_hazard_zones_at_point(
  p_longitude double precision,
  p_latitude double precision,
  p_hazard_type text DEFAULT NULL,
  p_tolerance_m double precision DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  hazard_type text,
  source_layer text,
  risk_level integer,
  depth_min_m numeric,
  depth_max_m numeric,
  area_context text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH point_input AS (
    SELECT
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326) AS geom,
      LEAST(GREATEST(COALESCE(p_tolerance_m, 0), 0), 50) AS tolerance_m
  )
  SELECT
    hz.id,
    hz.hazard_type,
    hz.source_layer,
    hz.risk_level,
    hz.depth_min_m,
    hz.depth_max_m,
    hz.area_context
  FROM public.hazard_zones hz
  CROSS JOIN point_input
  WHERE p_longitude BETWEEN 122 AND 154
    AND p_latitude BETWEEN 20 AND 46
    AND (p_hazard_type IS NULL OR hz.hazard_type = p_hazard_type)
    AND (
      ST_Intersects(hz.geom, point_input.geom)
      OR (
        point_input.tolerance_m > 0
        AND ST_DWithin(
          hz.geom::geography,
          point_input.geom::geography,
          point_input.tolerance_m
        )
      )
    )
  ORDER BY hz.risk_level DESC, hz.depth_max_m DESC NULLS LAST, hz.id;
$$;

REVOKE ALL ON FUNCTION public.get_hazard_zones_at_point(
  double precision,
  double precision,
  text,
  double precision
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hazard_zones_at_point(
  double precision,
  double precision,
  text,
  double precision
) TO authenticated, service_role;

-- A zone lookup returning no rows cannot distinguish a covered point from an
-- unimported region. This companion RPC supplies that missing gate signal.
CREATE OR REPLACE FUNCTION public.has_hazard_zone_coverage_at_point(
  p_longitude double precision,
  p_latitude double precision,
  p_hazard_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    p_longitude BETWEEN 122 AND 154
    AND p_latitude BETWEEN 20 AND 46
    AND EXISTS (
      SELECT 1
      FROM public.hazard_zone_coverage coverage
      WHERE coverage.hazard_type = p_hazard_type
        AND ST_Intersects(
          coverage.coverage_geom,
          ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.has_hazard_zone_coverage_at_point(
  double precision,
  double precision,
  text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_hazard_zone_coverage_at_point(
  double precision,
  double precision,
  text
) TO authenticated, service_role;
