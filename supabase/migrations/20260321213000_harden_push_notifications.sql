-- Push notifications hardening:
-- - prevent duplicate danger-report push delivery across immediate send + cron
-- - allow atomic claim/retry flow per danger report

ALTER TABLE public.danger_reports
ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS danger_reports_push_notified_at_idx
  ON public.danger_reports (push_notified_at);

CREATE INDEX IF NOT EXISTS danger_reports_created_at_push_notified_at_idx
  ON public.danger_reports (created_at, push_notified_at);
