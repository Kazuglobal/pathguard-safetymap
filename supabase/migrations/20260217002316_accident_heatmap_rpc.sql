-- RPC: get_accidents_in_bbox
-- 地図のビューポート範囲内の交通事故データをGeoJSON FeatureCollectionとして返す
-- ヒートマップ表示およびズーム時の個別サークル表示に使用

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
        'coordinates', json_build_array(a.longitude, a.latitude)
      ),
      'properties', json_build_object(
        'id', a.id,
        'severity', a.severity_code,
        'fatalities', COALESCE(a.fatalities, 0),
        'injuries', COALESCE(a.injuries, 0),
        'year', a.source_year,
        'type', a.accident_type_label,
        'hasChild', COALESCE(a.involves_child, false),
        'hasPedestrian', COALESCE(a.involves_pedestrian, false),
        'date', a.occurred_at,
        'weather', a.weather_label,
        'roadShape', a.road_shape_label,
        'dayNight', a.day_night_code
      )
    ) AS feature
    FROM traffic_accidents a
    WHERE
      a.location && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
      AND a.source_year BETWEEN p_min_year AND p_max_year
      AND (p_severity_filter = 'all' OR (p_severity_filter = 'fatal' AND a.severity_code = 1))
      AND (p_child_filter IS NULL OR a.involves_child = p_child_filter)
      AND (p_pedestrian_filter IS NULL OR a.involves_pedestrian = p_pedestrian_filter)
    LIMIT p_limit
  ) f;

  RETURN result;
END;
$$;

-- アクセス権限（公開データ）
GRANT EXECUTE ON FUNCTION public.get_accidents_in_bbox TO anon, authenticated;

-- 複合インデックス（年度+重大度フィルター高速化）
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_year_severity
  ON traffic_accidents(source_year, severity_code);

-- 空間インデックス（既存の場合はスキップ）
CREATE INDEX IF NOT EXISTS idx_traffic_accidents_location_gist
  ON traffic_accidents USING GIST(location);
