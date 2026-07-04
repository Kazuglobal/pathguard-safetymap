-- ============================================
-- danger_reports INSERT の status を RLS で拘束する
-- ============================================
--
-- 背景:
-- 20260203131004_consolidate_duplicate_policies.sql の "danger_reports_insert"
-- ポリシーは WITH CHECK (user_id = (SELECT auth.uid())) のみで、status カラムを
-- 一切制約していなかった。そのため認証済みユーザーが supabase-js から直接
-- insert({ user_id: self, status: 'approved', ... }) を実行すると、サーバ側の
-- AI一次審査 (lib/suspicious-alert-moderation.ts 経由の
-- /api/suspicious-alert/moderate、または管理者の承認フロー) を一切経由せずに、
-- いきなり全員の地図に公開される状態でレポートを投稿できてしまっていた。
--
-- 本番での挙動:
-- - 非admin ユーザーは status='pending' でのみ INSERT できる。
--   （NULL や 'approved'/'published'/'resolved'/'rejected' 等を自分で指定した
--   INSERT は RLS 違反 (42501) として拒否される）
-- - profiles.role='admin' のユーザーのみ、任意の status で INSERT できる
--   （danger_reports_update / danger_reports_delete と同じ admin 判定パターン）。
-- - 正規の承認フローは pending → (サーバの service_role クライアントによる)
--   AI審査/管理者承認 → approved の順で進み、service_role は RLS の対象外
--   のため本変更による影響はない。
-- - components/map/map-container.tsx / danger-report-form.tsx は既に
--   status: "published" で INSERT を試みて RLS 違反時に "pending" として
--   リトライする実装 (shouldRetryDangerReportInsertAsPending) になっており、
--   本ポリシーの適用によりこのフォールバックが正しく機能するようになる。

DROP POLICY IF EXISTS "danger_reports_insert" ON public.danger_reports;

CREATE POLICY "danger_reports_insert" ON public.danger_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      status = 'pending'
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = (SELECT auth.uid()) AND role = 'admin'
      )
    )
  );

-- ============================================
-- 他テーブルの同種脆弱性の確認（対応不要であることの確認）
-- ============================================
--
-- - local_safety_alerts (20260329000001_add_local_safety_alerts.sql):
--   INSERT/UPDATE/DELETE は "local_safety_alerts_service_role_all"
--   (auth.role() = 'service_role') のみが許可されており、認証ユーザー向けの
--   INSERT ポリシーは存在しない（select のみ authenticated/anon に許可）。
--   クライアントから直接 INSERT する経路が無いため対応不要。
--
-- - danger_spots (20260203131028_optimize_rls_initplan.sql):
--   "danger_spots_insert" / "danger_spots_update" は
--   WITH CHECK (user_id = (SELECT auth.uid())) のみで、承認状態を表す
--   status 相当のカラムを公開判定に使っていない
--   （公開/非公開の判定は danger_reports 側で行われる）ため対応不要。
