
-- 既存の厳格なINSERTポリシーを削除
DROP POLICY IF EXISTS "danger_reports_insert_own" ON storage.objects;

-- 認証済みユーザーならアップロード可能な新ポリシーを作成
CREATE POLICY "danger_reports_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'danger-reports');

-- UPDATE/DELETEも同様に緩和（自分がアップロードした画像以外も更新・削除の可能性）
DROP POLICY IF EXISTS "danger_reports_update_own" ON storage.objects;
CREATE POLICY "danger_reports_update_authenticated"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'danger-reports')
WITH CHECK (bucket_id = 'danger-reports');

DROP POLICY IF EXISTS "danger_reports_delete_own" ON storage.objects;
CREATE POLICY "danger_reports_delete_authenticated"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'danger-reports');
;
