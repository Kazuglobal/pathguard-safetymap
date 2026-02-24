-- Lift per-function timeout for heavy viewport aggregation RPC.
-- Keep scoped to this function only.

ALTER FUNCTION public.get_accidents_in_bbox(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  INT,
  INT,
  TEXT,
  BOOLEAN,
  BOOLEAN,
  INT
) SET statement_timeout = '12s';
