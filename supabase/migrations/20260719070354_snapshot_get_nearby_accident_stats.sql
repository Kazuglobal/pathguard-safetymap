-- Based on the deployed pathguardian definition exported with pg_get_functiondef on 2026-07-19.
-- Parameter bounds are added here so the SECURITY DEFINER function cannot be
-- used to amplify an unbounded spatial scan.

CREATE OR REPLACE FUNCTION public.get_nearby_accident_stats(p_latitude double precision, p_longitude double precision, p_radius_meters integer DEFAULT 200, p_years integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_point   geography;
  v_result  jsonb;
  v_min_year int;
BEGIN
  IF p_latitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90
    OR p_longitude IS NULL OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'latitude or longitude is out of range'
      USING ERRCODE = '22023';
  END IF;
  IF p_radius_meters IS NULL OR p_radius_meters NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'radius must be between 1 and 1000 metres'
      USING ERRCODE = '22023';
  END IF;
  IF p_years IS NULL OR p_years NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'years must be between 1 and 10'
      USING ERRCODE = '22023';
  END IF;

  v_point    := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;
  v_min_year := EXTRACT(YEAR FROM now())::int - p_years;

  SELECT jsonb_build_object(
    'total_accidents',   COUNT(*),
    'total_fatalities',  COALESCE(SUM(t.fatalities), 0),
    'total_injuries',    COALESCE(SUM(t.injuries), 0),
    'child_involved',    COUNT(*) FILTER (WHERE t.involves_child = true),
    'pedestrian_involved', COUNT(*) FILTER (WHERE t.involves_pedestrian = true),
    'fatal_accidents',   COUNT(*) FILTER (WHERE t.severity_code = 1),

    'by_year', (
      SELECT COALESCE(jsonb_object_agg(yr, cnt), '{}'::jsonb)
      FROM (
        SELECT source_year as yr, COUNT(*) as cnt
        FROM traffic_accidents t2
        WHERE ST_DWithin(t2.location, v_point, p_radius_meters)
          AND t2.source_year >= v_min_year
        GROUP BY source_year ORDER BY source_year
      ) sub
    ),

    'by_time_of_day', (
      SELECT COALESCE(jsonb_object_agg(hour_group, cnt), '{}'::jsonb)
      FROM (
        SELECT
          CASE
            WHEN EXTRACT(HOUR FROM occurred_at) BETWEEN 7 AND 8  THEN '07-09_morning_commute'
            WHEN EXTRACT(HOUR FROM occurred_at) BETWEEN 14 AND 16 THEN '14-17_after_school'
            WHEN EXTRACT(HOUR FROM occurred_at) BETWEEN 17 AND 18 THEN '17-19_evening'
            ELSE 'other'
          END as hour_group,
          COUNT(*) as cnt
        FROM traffic_accidents t3
        WHERE ST_DWithin(t3.location, v_point, p_radius_meters)
          AND t3.source_year >= v_min_year AND t3.occurred_at IS NOT NULL
        GROUP BY hour_group
      ) sub
    ),

    'by_weather', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(weather_label, '不明'), cnt), '{}'::jsonb)
      FROM (
        SELECT weather_label, COUNT(*) as cnt
        FROM traffic_accidents t4
        WHERE ST_DWithin(t4.location, v_point, p_radius_meters) AND t4.source_year >= v_min_year
        GROUP BY weather_label ORDER BY cnt DESC LIMIT 5
      ) sub
    ),

    'by_accident_type', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(accident_type_label, '不明'), cnt), '{}'::jsonb)
      FROM (
        SELECT accident_type_label, COUNT(*) as cnt
        FROM traffic_accidents t6
        WHERE ST_DWithin(t6.location, v_point, p_radius_meters) AND t6.source_year >= v_min_year
        GROUP BY accident_type_label ORDER BY cnt DESC LIMIT 5
      ) sub
    ),

    'by_party_type', (
      SELECT COALESCE(jsonb_object_agg(party_type, cnt), '{}'::jsonb)
      FROM (
        SELECT party_type, SUM(c) as cnt FROM (
          SELECT COALESCE(party_a_type_label, '不明') as party_type, COUNT(*) as c
          FROM traffic_accidents pa
          WHERE ST_DWithin(pa.location, v_point, p_radius_meters) AND pa.source_year >= v_min_year AND pa.party_a_type_label IS NOT NULL
          GROUP BY party_a_type_label
          UNION ALL
          SELECT COALESCE(party_b_type_label, '不明') as party_type, COUNT(*) as c
          FROM traffic_accidents pb
          WHERE ST_DWithin(pb.location, v_point, p_radius_meters) AND pb.source_year >= v_min_year AND pb.party_b_type_label IS NOT NULL
          GROUP BY party_b_type_label
        ) combined
        GROUP BY party_type ORDER BY cnt DESC LIMIT 8
      ) sub
    ),

    'by_road_surface', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(road_surface_label, '不明'), cnt), '{}'::jsonb)
      FROM (
        SELECT road_surface_label, COUNT(*) as cnt
        FROM traffic_accidents rs
        WHERE ST_DWithin(rs.location, v_point, p_radius_meters) AND rs.source_year >= v_min_year AND rs.road_surface_label IS NOT NULL
        GROUP BY road_surface_label ORDER BY cnt DESC
      ) sub
    ),

    'by_terrain', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(terrain_label, '不明'), cnt), '{}'::jsonb)
      FROM (
        SELECT terrain_label, COUNT(*) as cnt
        FROM traffic_accidents tr
        WHERE ST_DWithin(tr.location, v_point, p_radius_meters) AND tr.source_year >= v_min_year AND tr.terrain_label IS NOT NULL
        GROUP BY terrain_label ORDER BY cnt DESC
      ) sub
    ),

    'injury_analysis', jsonb_build_object(
      'by_injury_level', (
        SELECT COALESCE(jsonb_object_agg(level, cnt), '{}'::jsonb)
        FROM (
          SELECT level, SUM(c) as cnt FROM (
            SELECT COALESCE(injury_level_a, '不明') as level, COUNT(*) as c
            FROM traffic_accidents ia
            WHERE ST_DWithin(ia.location, v_point, p_radius_meters) AND ia.source_year >= v_min_year AND ia.injury_level_a IS NOT NULL
            GROUP BY injury_level_a
            UNION ALL
            SELECT COALESCE(injury_level_b, '不明') as level, COUNT(*) as c
            FROM traffic_accidents ib
            WHERE ST_DWithin(ib.location, v_point, p_radius_meters) AND ib.source_year >= v_min_year AND ib.injury_level_b IS NOT NULL
            GROUP BY injury_level_b
          ) combined
          GROUP BY level ORDER BY cnt DESC
        ) sub
      ),
      'severe_ratio', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE injury_level_a IN ('死亡', '重傷') OR injury_level_b IN ('死亡', '重傷'))::numeric
            / COUNT(*)::numeric * 100
          ) END
        FROM traffic_accidents sr
        WHERE ST_DWithin(sr.location, v_point, p_radius_meters) AND sr.source_year >= v_min_year
          AND (sr.injury_level_a IS NOT NULL OR sr.injury_level_b IS NOT NULL)
      )
    ),

    'road_environment', jsonb_build_object(
      'by_road_shape', (
        SELECT COALESCE(jsonb_object_agg(COALESCE(road_shape_label, '不明'), cnt), '{}'::jsonb)
        FROM (
          SELECT road_shape_label, COUNT(*) as cnt
          FROM traffic_accidents tre
          WHERE ST_DWithin(tre.location, v_point, p_radius_meters) AND tre.source_year >= v_min_year AND tre.road_shape_label IS NOT NULL
          GROUP BY road_shape_label ORDER BY cnt DESC LIMIT 5
        ) sub
      ),
      'by_sidewalk', (
        SELECT COALESCE(jsonb_object_agg(COALESCE(sidewalk_label, '不明'), cnt), '{}'::jsonb)
        FROM (
          SELECT sidewalk_label, COUNT(*) as cnt
          FROM traffic_accidents ts
          WHERE ST_DWithin(ts.location, v_point, p_radius_meters) AND ts.source_year >= v_min_year AND ts.sidewalk_label IS NOT NULL
          GROUP BY sidewalk_label ORDER BY cnt DESC LIMIT 5
        ) sub
      ),
      'intersection_ratio', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE road_shape_label LIKE '%交差点%')::numeric
            / COUNT(*)::numeric * 100
          ) END
        FROM traffic_accidents ti
        WHERE ST_DWithin(ti.location, v_point, p_radius_meters) AND ti.source_year >= v_min_year AND ti.road_shape_label IS NOT NULL
      ),
      'no_sidewalk_ratio', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE sidewalk_label IN ('区分なし', '区別なし'))::numeric
            / COUNT(*)::numeric * 100
          ) END
        FROM traffic_accidents tn
        WHERE ST_DWithin(tn.location, v_point, p_radius_meters) AND tn.source_year >= v_min_year AND tn.sidewalk_label IS NOT NULL
      )
    ),

    'party_analysis', jsonb_build_object(
      'by_age_group', (
        SELECT COALESCE(jsonb_object_agg(age_group, cnt), '{}'::jsonb)
        FROM (
          SELECT
            CASE
              WHEN age IN (0, 1) THEN '24歳以下'
              WHEN age = 25 THEN '25-34歳' WHEN age = 35 THEN '35-44歳'
              WHEN age = 45 THEN '45-54歳' WHEN age = 55 THEN '55-64歳'
              WHEN age = 65 THEN '65-74歳' WHEN age = 75 THEN '75歳以上'
              ELSE '不明'
            END as age_group, COUNT(*) as cnt
          FROM (
            SELECT party_a_age as age FROM traffic_accidents ta
            WHERE ST_DWithin(ta.location, v_point, p_radius_meters) AND ta.source_year >= v_min_year AND ta.party_a_age IS NOT NULL
            UNION ALL
            SELECT party_b_age as age FROM traffic_accidents tb
            WHERE ST_DWithin(tb.location, v_point, p_radius_meters) AND tb.source_year >= v_min_year AND tb.party_b_age IS NOT NULL
          ) ages
          WHERE age > 0
          GROUP BY age_group ORDER BY cnt DESC
        ) sub
      ),
      'elderly_ratio', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE party_a_age >= 65 OR party_b_age >= 65)::numeric
            / COUNT(*)::numeric * 100
          ) END
        FROM traffic_accidents te
        WHERE ST_DWithin(te.location, v_point, p_radius_meters) AND te.source_year >= v_min_year
      ),
      'young_ratio', (
        SELECT CASE WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND(
            COUNT(*) FILTER (WHERE party_a_age <= 1 OR party_b_age <= 1)::numeric
            / COUNT(*)::numeric * 100
          ) END
        FROM traffic_accidents ty
        WHERE ST_DWithin(ty.location, v_point, p_radius_meters) AND ty.source_year >= v_min_year
      )
    ),

    'time_analysis', jsonb_build_object(
      'by_hour', (
        SELECT COALESCE(jsonb_object_agg(hr, cnt), '{}'::jsonb)
        FROM (
          SELECT EXTRACT(HOUR FROM occurred_at)::int as hr, COUNT(*) as cnt
          FROM traffic_accidents th
          WHERE ST_DWithin(th.location, v_point, p_radius_meters) AND th.source_year >= v_min_year AND th.occurred_at IS NOT NULL
          GROUP BY hr ORDER BY hr
        ) sub
      ),
      'by_month', (
        SELECT COALESCE(jsonb_object_agg(mo, cnt), '{}'::jsonb)
        FROM (
          SELECT EXTRACT(MONTH FROM occurred_at)::int as mo, COUNT(*) as cnt
          FROM traffic_accidents tm
          WHERE ST_DWithin(tm.location, v_point, p_radius_meters) AND tm.source_year >= v_min_year AND tm.occurred_at IS NOT NULL
          GROUP BY mo ORDER BY mo
        ) sub
      ),
      'peak_hour', (
        SELECT hr FROM (
          SELECT EXTRACT(HOUR FROM occurred_at)::int as hr, COUNT(*) as cnt
          FROM traffic_accidents tp
          WHERE ST_DWithin(tp.location, v_point, p_radius_meters) AND tp.source_year >= v_min_year AND tp.occurred_at IS NOT NULL
          GROUP BY hr ORDER BY cnt DESC LIMIT 1
        ) sub
      ),
      'peak_month', (
        SELECT mo FROM (
          SELECT EXTRACT(MONTH FROM occurred_at)::int as mo, COUNT(*) as cnt
          FROM traffic_accidents tpm
          WHERE ST_DWithin(tpm.location, v_point, p_radius_meters) AND tpm.source_year >= v_min_year AND tpm.occurred_at IS NOT NULL
          GROUP BY mo ORDER BY cnt DESC LIMIT 1
        ) sub
      )
    ),

    'nearest_accidents', (
      SELECT COALESCE(jsonb_agg(acc ORDER BY dist), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'distance_m',         ROUND(ST_Distance(t7.location, v_point)::numeric, 1),
          'year',               t7.source_year,
          'occurred_at',        to_char(t7.occurred_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD HH24:MI'),
          'type',               t7.accident_type_label,
          'severity',           CASE t7.severity_code WHEN 1 THEN 'fatal' ELSE 'injury' END,
          'fatalities',         t7.fatalities,
          'injuries',           t7.injuries,
          'involved_child',     t7.involves_child,
          'involved_pedestrian',t7.involves_pedestrian,
          'weather',            t7.weather_label,
          'road_shape',         t7.road_shape_label,
          'sidewalk',           t7.sidewalk_label,
          'road_surface',       t7.road_surface_label,
          'terrain',            t7.terrain_label,
          'party_a_type',       t7.party_a_type_label,
          'party_b_type',       t7.party_b_type_label,
          'injury_a',           t7.injury_level_a,
          'injury_b',           t7.injury_level_b,
          'party_a_age',        t7.party_a_age,
          'party_b_age',        t7.party_b_age,
          'latitude',           t7.latitude,
          'longitude',          t7.longitude
        ) as acc,
        ST_Distance(t7.location, v_point) as dist
        FROM traffic_accidents t7
        WHERE ST_DWithin(t7.location, v_point, p_radius_meters) AND t7.source_year >= v_min_year
        ORDER BY dist LIMIT 10
      ) sub
    ),

    'risk_score', (
      SELECT LEAST(100, (
        LEAST(60, COUNT(*) * 10) +
        LEAST(20, COUNT(*) FILTER (WHERE t8.severity_code = 1) * 20) +
        LEAST(15, COUNT(*) FILTER (WHERE t8.involves_child) * 15) +
        LEAST(10, COUNT(*) FILTER (WHERE t8.involves_pedestrian) * 5)
      ))
      FROM traffic_accidents t8
      WHERE ST_DWithin(t8.location, v_point, p_radius_meters) AND t8.source_year >= v_min_year
    ),

    'situation_summary', (
      SELECT jsonb_build_object(
        'total_text',      COUNT(*) || '件の事故が過去' || p_years || '年間に半径' || p_radius_meters || 'm以内で発生',
        'severity_text',
          CASE WHEN COUNT(*) FILTER (WHERE severity_code = 1) > 0
          THEN '死亡事故' || COUNT(*) FILTER (WHERE severity_code = 1) || '件を含む'
          ELSE '死亡事故なし' END,
        'pedestrian_text',
          CASE WHEN COUNT(*) FILTER (WHERE accident_type_label LIKE '%人対車両%') > 0
          THEN '歩行者事故' || COUNT(*) FILTER (WHERE accident_type_label LIKE '%人対車両%') || '件（横断中' || COUNT(*) FILTER (WHERE accident_type_label LIKE '%横断%') || '件）'
          ELSE '歩行者事故なし' END,
        'weather_risk_text',
          CASE WHEN COUNT(*) FILTER (WHERE weather_label IN ('雨', '雪', '霧')) > 0
          THEN '悪天候時の事故' || COUNT(*) FILTER (WHERE weather_label IN ('雨', '雪', '霧')) || '件（全体の' ||
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(COUNT(*) FILTER (WHERE weather_label IN ('雨', '雪', '霧'))::numeric / COUNT(*)::numeric * 100) END || '%）'
          ELSE '悪天候時の事故なし' END,
        'road_text',
          CASE
            WHEN COUNT(*) FILTER (WHERE road_shape_label LIKE '%交差点%') > COUNT(*) * 0.5 THEN '事故の過半数が交差点で発生'
            WHEN COUNT(*) FILTER (WHERE road_shape_label LIKE '%単路%') > COUNT(*) * 0.5 THEN '事故の過半数が直線道路で発生'
            ELSE '交差点・直線道路ともに事故あり'
          END,
        'surface_text',
          CASE WHEN COUNT(*) FILTER (WHERE road_surface_label IN ('湿潤', '凍結', '積雪')) > COUNT(*) * 0.2
          THEN '路面状態が悪い時の事故が多い（' ||
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(COUNT(*) FILTER (WHERE road_surface_label IN ('湿潤', '凍結', '積雪'))::numeric / COUNT(*)::numeric * 100) END || '%）'
          ELSE NULL END,
        'elderly_text',
          CASE WHEN COUNT(*) FILTER (WHERE party_a_age >= 65 OR party_b_age >= 65) > COUNT(*) * 0.3
          THEN '高齢者（65歳以上）関与率が高い（' ||
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(COUNT(*) FILTER (WHERE party_a_age >= 65 OR party_b_age >= 65)::numeric / COUNT(*)::numeric * 100) END || '%）'
          ELSE NULL END
      )
      FROM traffic_accidents tss
      WHERE ST_DWithin(tss.location, v_point, p_radius_meters) AND tss.source_year >= v_min_year
    ),

    'search_params', jsonb_build_object(
      'latitude',       p_latitude,
      'longitude',      p_longitude,
      'radius_meters',  p_radius_meters,
      'years',          p_years
    )
  ) INTO v_result
  FROM traffic_accidents t
  WHERE ST_DWithin(t.location, v_point, p_radius_meters)
    AND t.source_year >= v_min_year;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_nearby_accident_stats(double precision, double precision, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_accident_stats(double precision, double precision, integer, integer) TO anon, authenticated, service_role;
