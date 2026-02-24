
-- ============================================
-- 重複RLSポリシーの整理・統合
-- danger_reports, profiles, user_routes テーブル
-- ============================================

-- ============================================
-- 1. danger_reports テーブルのポリシー統合
-- ============================================

-- 既存の重複ポリシーをすべて削除
DROP POLICY IF EXISTS "danger_reports_select_approved" ON public.danger_reports;
DROP POLICY IF EXISTS "danger_reports_select_own" ON public.danger_reports;
DROP POLICY IF EXISTS "danger_reports_insert_own" ON public.danger_reports;
DROP POLICY IF EXISTS "danger_reports_update_own" ON public.danger_reports;
DROP POLICY IF EXISTS "danger_reports_delete_own" ON public.danger_reports;
DROP POLICY IF EXISTS "admin_all_access" ON public.danger_reports;
DROP POLICY IF EXISTS "user_insert_own" ON public.danger_reports;
DROP POLICY IF EXISTS "user_read_own" ON public.danger_reports;
DROP POLICY IF EXISTS "user_update_own" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所作成ポリシー" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所削除ポリシー" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所報告は本人のみ編集可能" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所報告は認証ユーザーのみ作成可能" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所報告は誰でも閲覧可能" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所編集ポリシー" ON public.danger_reports;
DROP POLICY IF EXISTS "危険箇所閲覧ポリシー" ON public.danger_reports;
DROP POLICY IF EXISTS "管理者は全ての危険箇所報告を編集可能" ON public.danger_reports;
DROP POLICY IF EXISTS "管理者危険箇所管理ポリシー" ON public.danger_reports;

-- 統合された新しいポリシーを作成（auth.uid()を(select auth.uid())に最適化）

-- SELECT: 承認済み/解決済みは誰でも、自分のは全て、管理者は全て閲覧可能
CREATE POLICY "danger_reports_select" ON public.danger_reports
  FOR SELECT
  TO public
  USING (
    status IN ('approved', 'resolved')
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- INSERT: 認証ユーザーのみ、自分のレポートとして作成
CREATE POLICY "danger_reports_insert" ON public.danger_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- UPDATE: 自分のpendingレポート、または管理者は全て編集可能
CREATE POLICY "danger_reports_update" ON public.danger_reports
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- DELETE: 自分のpendingレポート、または管理者は削除可能
CREATE POLICY "danger_reports_delete" ON public.danger_reports
  FOR DELETE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================
-- 2. profiles テーブルのポリシー統合
-- ============================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "プロフィール閲覧ポリシー" ON public.profiles;
DROP POLICY IF EXISTS "プロフィール編集ポリシー" ON public.profiles;
DROP POLICY IF EXISTS "管理者プロフィール閲覧ポリシー" ON public.profiles;

-- SELECT: 自分のプロフィール、または管理者は全て閲覧可能
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  TO public
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
    )
  );

-- INSERT: 自分のプロフィールのみ作成可能
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (
    id = (SELECT auth.uid())
  );

-- UPDATE: 自分のプロフィールのみ編集可能
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  TO public
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ============================================
-- 3. user_routes テーブルのポリシー統合
-- ============================================

DROP POLICY IF EXISTS "Users can view own routes" ON public.user_routes;
DROP POLICY IF EXISTS "Users can insert own routes" ON public.user_routes;
DROP POLICY IF EXISTS "Users can update own routes" ON public.user_routes;
DROP POLICY IF EXISTS "Users can delete own routes" ON public.user_routes;
DROP POLICY IF EXISTS "user_routes_select_own" ON public.user_routes;
DROP POLICY IF EXISTS "user_routes_insert_own" ON public.user_routes;
DROP POLICY IF EXISTS "user_routes_update_own" ON public.user_routes;
DROP POLICY IF EXISTS "user_routes_delete_own" ON public.user_routes;

-- 統合されたポリシー
CREATE POLICY "user_routes_select" ON public.user_routes
  FOR SELECT
  TO public
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_routes_insert" ON public.user_routes
  FOR INSERT
  TO public
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_routes_update" ON public.user_routes
  FOR UPDATE
  TO public
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_routes_delete" ON public.user_routes
  FOR DELETE
  TO public
  USING (user_id = (SELECT auth.uid()));
;
