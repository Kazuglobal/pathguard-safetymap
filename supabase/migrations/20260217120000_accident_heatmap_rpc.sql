-- RPC: get_accidents_in_bbox
-- Returns GeoJSON FeatureCollection for accidents within viewport bounds
-- Supports filters: year range, severity, child involvement, pedestrian

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(f.feature), '[]'::json)
  ) INTO result
  FROM (
    SELECT json_build_object(
      'type', 'Feature',
      'geometry', json_build_object(
        'type', 'Point',
        'coordinates', json_build_array(longitude, latitude)
      ),
      'properties', json_build_object(
        'id', id,
        'severity', severity_code,
        'fatalities', COALESCE(fatalities, 0),
        'injuries', COALESCE(injuries, 0),
        'year', source_year,
        'type', accident_type_label,
        'hasChild', involves_child,
        'hasPedestrian', involves_pedestrian,
        'date', occurred_at,
        'weather', weather_label,
        'roadShape', road_shape_label,
        'dayNight', day_night_code
      )
    ) AS feature
    FROM traffic_accidents
    WHERE
      location && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
      AND source_year BETWEEN p_min_year AND p_max_year
      AND (p_severity_filter = 'all' OR (p_severity_filter = 'fatal' AND severity_code = 1))
      AND (p_child_filter IS NULL OR involves_child = p_child_filter)
      AND (p_pedestrian_filter IS NULL OR involves_pedestrian = p_pedestrian_filter)
    LIMIT p_limit
  ) f;

  RETURN result;
END;
$$;

-- Grant to both anon and authenticated (public safety data)
GRANT EXECUTE ON FUNCTION public.get_accidents_in_bbox TO anon, authenticated;

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_year_severity
  ON traffic_accidents(source_year, severity_code);
