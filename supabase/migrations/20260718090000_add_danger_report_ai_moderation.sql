-- ============================================
-- 危険箇所レポート AI一次審査の永続化・RLS・キュー索引
-- ============================================

-- 制約追加前に、旧実装や直接書き込みで未知の値が残っていないことを明示的に確認する。
-- 不正値を暗黙に書き換えると監査情報を失うため、存在する場合は適用を停止して手動確認する。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.danger_reports
    WHERE ai_moderation_status IS NOT NULL
      AND ai_moderation_status NOT IN (
        'pending',
        'approved',
        'needs_review',
        'escalated'
      )
  ) THEN
    RAISE EXCEPTION
      'danger_reports.ai_moderation_status contains unsupported values; review them before applying this migration';
  END IF;
END
$$;

ALTER TABLE public.danger_reports
  DROP CONSTRAINT IF EXISTS danger_reports_ai_moderation_status_check;

ALTER TABLE public.danger_reports
  ADD CONSTRAINT danger_reports_ai_moderation_status_check
  CHECK (
    ai_moderation_status IS NULL
    OR ai_moderation_status IN (
      'pending',
      'approved',
      'needs_review',
      'escalated'
    )
  );

COMMENT ON COLUMN public.danger_reports.ai_moderation_status IS
  'AI一次審査状態: pending, approved, needs_review, escalated。却下は人間が danger_reports.status で判断する。';

-- 非adminが確定済みのAI判定をINSERTして審査パイプラインを迂回することを防ぐ。
DROP POLICY IF EXISTS "danger_reports_insert" ON public.danger_reports;

CREATE POLICY "danger_reports_insert" ON public.danger_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      (
        status = 'pending'
        AND (
          ai_moderation_status IS NULL
          OR ai_moderation_status = 'pending'
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = (SELECT auth.uid()) AND role = 'admin'
      )
    )
  );

-- RLSは列単位の変更を比較できないため、本人がpendingレポートを編集できる
-- 既存仕様を保ったまま、サーバ管理のAI審査列だけをトリガーで保護する。
CREATE OR REPLACE FUNCTION public.protect_danger_report_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (
    OLD.ai_moderation_status IS DISTINCT FROM NEW.ai_moderation_status
    OR OLD.ai_moderation_reason IS DISTINCT FROM NEW.ai_moderation_reason
    OR OLD.ai_moderation_score IS DISTINCT FROM NEW.ai_moderation_score
    OR OLD.ai_moderation_checked_at IS DISTINCT FROM NEW.ai_moderation_checked_at
  )
  AND NOT (
    current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION
      'AI moderation fields are server-managed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_danger_report_moderation_fields()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_danger_report_moderation_fields
  ON public.danger_reports;
CREATE TRIGGER protect_danger_report_moderation_fields
  BEFORE UPDATE OF
    ai_moderation_status,
    ai_moderation_reason,
    ai_moderation_score,
    ai_moderation_checked_at
  ON public.danger_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_danger_report_moderation_fields();

-- シャドー運用・本稼働・バックテストを同じ形式で監査するappend-onlyログ。
-- RLSポリシーを作らないため、authenticated/anonは読み書きできずservice_roleのみが扱う。
CREATE TABLE public.danger_report_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.danger_reports(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('shadow', 'live')),
  heuristic_status text NOT NULL CHECK (
    heuristic_status IN ('approved', 'needs_review', 'escalated')
  ),
  ai_verdict jsonb,
  final_status text NOT NULL CHECK (
    final_status IN ('approved', 'needs_review', 'escalated')
  ),
  fallback boolean NOT NULL DEFAULT false,
  model text,
  prompt_version text NOT NULL,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.danger_report_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_danger_report_moderation_log_report_id
  ON public.danger_report_moderation_log (report_id);

CREATE INDEX idx_danger_reports_moderation_sweep
  ON public.danger_reports (created_at)
  WHERE status = 'pending'
    AND (
      ai_moderation_status IS NULL
      OR ai_moderation_status = 'pending'
    );

CREATE INDEX idx_danger_reports_escalated
  ON public.danger_reports (created_at DESC)
  WHERE ai_moderation_status = 'escalated';

-- shadowは同じprompt_versionで一度だけ評価する。NOT EXISTSをDB側で行うことで、
-- 既評価の先頭10件が未評価レポートを飢餓状態にすることも防ぐ。
CREATE OR REPLACE FUNCTION public.get_danger_reports_for_moderation_sweep(
  p_mode text,
  p_prompt_version text,
  p_cutoff timestamptz,
  p_limit integer DEFAULT 10
)
RETURNS SETOF public.danger_reports
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT report.*
  FROM public.danger_reports AS report
  WHERE report.status = 'pending'
    AND (
      report.ai_moderation_status IS NULL
      OR report.ai_moderation_status = 'pending'
    )
    AND report.created_at < p_cutoff
    AND (
      p_mode <> 'shadow'
      OR NOT EXISTS (
        SELECT 1
        FROM public.danger_report_moderation_log AS log
        WHERE log.report_id = report.id
          AND log.mode = 'shadow'
          AND log.prompt_version = p_prompt_version
      )
    )
  ORDER BY report.created_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_danger_reports_for_moderation_sweep(
  text,
  text,
  timestamptz,
  integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_danger_reports_for_moderation_sweep(
  text,
  text,
  timestamptz,
  integer
) TO service_role;

-- 画像URLの書き込みとAI承認済みレポートの差し戻しを必ず同じUPDATEで行う。
-- service_roleからのみ呼び出し、読み取りと書き込みの間のTOCTOUを作らない。
CREATE OR REPLACE FUNCTION public.set_danger_report_image(
  p_report_id uuid,
  p_image_url text DEFAULT NULL,
  p_processed_image_urls text[] DEFAULT NULL
)
RETURNS SETOF public.danger_reports
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.danger_reports
  SET
    image_url = COALESCE(p_image_url, image_url),
    processed_image_urls = COALESCE(
      p_processed_image_urls,
      processed_image_urls
    ),
    status = CASE
      WHEN ai_moderation_status = 'approved' THEN 'pending'
      ELSE status
    END,
    ai_moderation_status = CASE
      WHEN ai_moderation_status = 'approved' THEN 'needs_review'
      ELSE ai_moderation_status
    END,
    ai_moderation_reason = CASE
      WHEN ai_moderation_status = 'approved' THEN
        CONCAT_WS(
          ' / ',
          NULLIF(ai_moderation_reason, ''),
          'AI承認後に画像が追加されたため、人間の確認に差し戻しました。'
        )
      ELSE ai_moderation_reason
    END,
    ai_moderation_checked_at = CASE
      WHEN ai_moderation_status = 'approved' THEN now()
      ELSE ai_moderation_checked_at
    END,
    updated_at = now()
  WHERE id = p_report_id
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.set_danger_report_image(uuid, text, text[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_danger_report_image(uuid, text, text[])
  TO service_role;
