-- Fix child-only filter for accident heatmap RPC.
-- Production data may contain child age codes without involves_child=true.
-- Treat age code "1" as child-involved fallback for filtering and response payload.

CREATE OR REPLACE FUNCTION public.get_accidents_in_bbox(
  p_min_lng DOUBLE PRECISION,
  p_min_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_min_year INT DEFAULT 2018,
  p_max_year INT DEFAULT 2023,
  p_severity_filter TEXT DEFAULT 'all',
  p_child_filter BOOLEAN DEFAULT NULL,
  p_pedestrian_filter BOOLEAN DEFAULT NULL,
  p_limit INT DEFAULT 10000
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_min_lng DOUBLE PRECISION;
  v_max_lng DOUBLE PRECISION;
  v_min_lat DOUBLE PRECISION;
  v_max_lat DOUBLE PRECISION;
  v_min_year INT;
  v_max_year INT;
  v_limit INT;
  v_year_tmp INT;
  v_severity_filter TEXT;
BEGIN
  IF p_min_lng IS NULL OR p_min_lat IS NULL OR p_max_lng IS NULL OR p_max_lat IS NULL THEN
    RETURN json_build_object('type', 'FeatureCollection', 'features', '[]'::json);
  END IF;

  v_min_lng := LEAST(p_min_lng, p_max_lng);
  v_max_lng := GREATEST(p_min_lng, p_max_lng);
  v_min_lat := LEAST(p_min_lat, p_max_lat);
  v_max_lat := GREATEST(p_min_lat, p_max_lat);

  IF v_min_lng < -180 OR v_max_lng > 180 OR v_min_lat < -90 OR v_max_lat > 90 THEN
    RETURN json_build_object('type', 'FeatureCollection', 'features', '[]'::json);
  END IF;

  v_min_year := COALESCE(p_min_year, 2018);
  v_max_year := COALESCE(p_max_year, 2023);
  IF v_min_year > v_max_year THEN
    v_year_tmp := v_min_year;
    v_min_year := v_max_year;
    v_max_year := v_year_tmp;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 10000), 1), 10000);
  v_severity_filter := CASE
    WHEN p_severity_filter = 'fatal' THEN 'fatal'
    ELSE 'all'
  END;

  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(f.feature), '[]'::json)
  ) INTO result
  FROM (
    SELECT json_build_object(
      'type', 'Feature',
      'geometry', json_build_object(
        'type', 'Point',
        'coordinates', json_build_array(a.longitude, a.latitude)
      ),
      'properties', json_build_object(
        'id', a.id,
        'severity', a.severity_code,
        'fatalities', COALESCE(a.fatalities, 0),
        'injuries', COALESCE(a.injuries, 0),
        'year', a.source_year,
        'type', a.accident_type_label,
        'hasChild', (
          COALESCE(a.involves_child, false)
          OR COALESCE(a.party_a_age, -1) = 1
          OR COALESCE(a.party_b_age, -1) = 1
        ),
        'hasPedestrian', COALESCE(a.involves_pedestrian, false),
        'date', a.occurred_at,
        'weather', a.weather_label,
        'roadShape', a.road_shape_label,
        'dayNight', a.day_night_code
      )
    ) AS feature
    FROM traffic_accidents a
    WHERE
      a.location && ST_MakeEnvelope(v_min_lng, v_min_lat, v_max_lng, v_max_lat, 4326)
      AND a.source_year BETWEEN v_min_year AND v_max_year
      AND (v_severity_filter = 'all' OR (v_severity_filter = 'fatal' AND a.severity_code = 1))
      AND (
        p_child_filter IS NULL
        OR (
          COALESCE(a.involves_child, false)
          OR COALESCE(a.party_a_age, -1) = 1
          OR COALESCE(a.party_b_age, -1) = 1
        ) = p_child_filter
      )
      AND (p_pedestrian_filter IS NULL OR a.involves_pedestrian = p_pedestrian_filter)
    ORDER BY a.source_year DESC, a.id DESC
    LIMIT v_limit
  ) f;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_accidents_in_bbox FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accidents_in_bbox TO anon, authenticated;
