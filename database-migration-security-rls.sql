-- Security Migration: Enable RLS for danger_reports and user_routes tables
-- セキュリティマイグレーション: danger_reportsとuser_routesテーブルのRLS有効化
-- Run this in Supabase SQL Editor
-- Supabase SQL Editorで実行してください

-- ============================================================================
-- IMPORTANT: This migration must be run to ensure data security
-- 重要: このマイグレーションはデータセキュリティのために必ず実行してください
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Enable RLS for danger_reports table
-- ============================================================================

ALTER TABLE public.danger_reports ENABLE ROW LEVEL SECURITY;

-- danger_reports: 承認済みレポートは全ユーザーが閲覧可能
DROP POLICY IF EXISTS "danger_reports_select_approved" ON public.danger_reports;
CREATE POLICY "danger_reports_select_approved" ON public.danger_reports
    FOR SELECT USING (status = 'approved');

-- danger_reports: 自分のレポートは全て閲覧可能（下書き含む）
DROP POLICY IF EXISTS "danger_reports_select_own" ON public.danger_reports;
CREATE POLICY "danger_reports_select_own" ON public.danger_reports
    FOR SELECT USING (auth.uid() = user_id);

-- danger_reports: 認証済みユーザーのみレポートを作成可能
DROP POLICY IF EXISTS "danger_reports_insert_own" ON public.danger_reports;
CREATE POLICY "danger_reports_insert_own" ON public.danger_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- danger_reports: 自分のレポートのみ更新可能
DROP POLICY IF EXISTS "danger_reports_update_own" ON public.danger_reports;
CREATE POLICY "danger_reports_update_own" ON public.danger_reports
    FOR UPDATE USING (auth.uid() = user_id);

-- danger_reports: 自分のレポートのみ削除可能
DROP POLICY IF EXISTS "danger_reports_delete_own" ON public.danger_reports;
CREATE POLICY "danger_reports_delete_own" ON public.danger_reports
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Step 2: Enable RLS for user_routes table
-- ============================================================================

ALTER TABLE public.user_routes ENABLE ROW LEVEL SECURITY;

-- user_routes: 自分のルートのみ閲覧可能（通学路は個人情報のため）
DROP POLICY IF EXISTS "user_routes_select_own" ON public.user_routes;
CREATE POLICY "user_routes_select_own" ON public.user_routes
    FOR SELECT USING (auth.uid() = user_id);

-- user_routes: 認証済みユーザーのみルートを作成可能
DROP POLICY IF EXISTS "user_routes_insert_own" ON public.user_routes;
CREATE POLICY "user_routes_insert_own" ON public.user_routes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_routes: 自分のルートのみ更新可能
DROP POLICY IF EXISTS "user_routes_update_own" ON public.user_routes;
CREATE POLICY "user_routes_update_own" ON public.user_routes
    FOR UPDATE USING (auth.uid() = user_id);

-- user_routes: 自分のルートのみ削除可能
DROP POLICY IF EXISTS "user_routes_delete_own" ON public.user_routes;
CREATE POLICY "user_routes_delete_own" ON public.user_routes
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Step 3: Enable RLS for address master tables (read-only for all)
-- ============================================================================

ALTER TABLE public.address_prefectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_municipalities ENABLE ROW LEVEL SECURITY;

-- 住所マスターテーブルは全ユーザー読み取り可能（公開情報）
DROP POLICY IF EXISTS "address_prefectures_select_all" ON public.address_prefectures;
CREATE POLICY "address_prefectures_select_all" ON public.address_prefectures
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "address_municipalities_select_all" ON public.address_municipalities;
CREATE POLICY "address_municipalities_select_all" ON public.address_municipalities
    FOR SELECT USING (true);

-- ============================================================================
-- Step 4: Verify RLS is enabled
-- ============================================================================

-- Check that RLS is enabled on all critical tables
DO $$
DECLARE
    tables_without_rls text;
BEGIN
    SELECT string_agg(tablename, ', ')
    INTO tables_without_rls
    FROM pg_tables t
    LEFT JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    AND t.tablename IN ('danger_reports', 'user_routes', 'user_badges', 'user_points', 'profiles', 'hazard_game_sessions')
    AND NOT c.relrowsecurity;

    IF tables_without_rls IS NOT NULL THEN
        RAISE WARNING 'WARNING: RLS is not enabled on these tables: %', tables_without_rls;
    ELSE
        RAISE NOTICE 'SUCCESS: RLS is enabled on all critical tables';
    END IF;
END;
$$;

COMMIT;

-- ============================================================================
-- Verification queries (run separately to check)
-- ============================================================================

-- Check RLS status for all tables
-- SELECT
--     schemaname,
--     tablename,
--     CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
-- FROM pg_tables t
-- JOIN pg_class c ON c.relname = t.tablename
-- WHERE t.schemaname = 'public'
-- ORDER BY tablename;

-- Check policies for danger_reports
-- SELECT * FROM pg_policies WHERE tablename = 'danger_reports';

-- Check policies for user_routes
-- SELECT * FROM pg_policies WHERE tablename = 'user_routes';
