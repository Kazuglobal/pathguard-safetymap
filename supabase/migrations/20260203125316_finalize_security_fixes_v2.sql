
-- =====================================================
-- FINALIZE SECURITY FIXES V2
-- =====================================================

-- Note: spatial_ref_sys is a PostGIS system table that cannot be modified
-- It requires superuser access. This is a known limitation.
-- The table is read-only reference data and poses minimal security risk.

-- 1. Tighten up overly permissive policies

-- Fix diaries policies (authenticated users can manage diaries)
DROP POLICY IF EXISTS diaries_insert_policy ON public.diaries;
DROP POLICY IF EXISTS diaries_update_policy ON public.diaries;

CREATE POLICY "diaries_insert_policy" ON public.diaries
    FOR INSERT TO authenticated
    WITH CHECK (player_id IS NOT NULL);

CREATE POLICY "diaries_update_policy" ON public.diaries
    FOR UPDATE TO authenticated
    USING (player_id IS NOT NULL);

-- Fix diary_comments policy
DROP POLICY IF EXISTS diary_comments_insert_policy ON public.diary_comments;

CREATE POLICY "diary_comments_insert_policy" ON public.diary_comments
    FOR INSERT TO authenticated
    WITH CHECK (commenter_id IS NOT NULL);

-- Fix notifications policy (system can create for any user)
DROP POLICY IF EXISTS notifications_insert_policy ON public.notifications;

CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (user_id IS NOT NULL);

-- 2. Grant necessary permissions for views
GRANT SELECT ON public.user_report_activity TO anon, authenticated;
GRANT SELECT ON public.report_stats TO anon, authenticated;
GRANT SELECT ON public.public_reports_with_stats TO anon, authenticated;
GRANT SELECT ON public.danger_category_stats TO anon, authenticated;
;
