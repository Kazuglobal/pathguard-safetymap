-- Migration: Add latitude/longitude range constraints for danger_reports
-- New/updated rows are protected immediately; existing rows are not back-validated in this migration.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'danger_reports_latitude_range'
      AND conrelid = 'public.danger_reports'::regclass
  ) THEN
    ALTER TABLE public.danger_reports
      ADD CONSTRAINT danger_reports_latitude_range
      CHECK (latitude >= -90 AND latitude <= 90) NOT VALID;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'danger_reports_longitude_range'
      AND conrelid = 'public.danger_reports'::regclass
  ) THEN
    ALTER TABLE public.danger_reports
      ADD CONSTRAINT danger_reports_longitude_range
      CHECK (longitude >= -180 AND longitude <= 180) NOT VALID;
  END IF;
END;
$$;

COMMIT;
