-- 緩和ポリシーを削除（20260211135652_relax_danger_reports_storage_insert_policy.sql で追加）
DROP POLICY IF EXISTS "danger_reports_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "danger_reports_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "danger_reports_delete_authenticated" ON storage.objects;

-- 所有者スコープのポリシーを復元（元のセキュアなポリシー）
CREATE POLICY "danger_reports_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'danger-reports'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "danger_reports_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'danger-reports' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'danger-reports' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "danger_reports_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'danger-reports' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
