-- Add indexes to stabilize child-filter heatmap RPC performance in production.

CREATE INDEX IF NOT EXISTS idx_traffic_accidents_child_fallback_year_severity
  ON public.traffic_accidents(source_year, severity_code)
  WHERE (involves_child IS TRUE OR party_a_age = 1 OR party_b_age = 1);

CREATE INDEX IF NOT EXISTS idx_traffic_accidents_child_fallback_location_gist
  ON public.traffic_accidents USING GIST(location)
  WHERE (involves_child IS TRUE OR party_a_age = 1 OR party_b_age = 1);
