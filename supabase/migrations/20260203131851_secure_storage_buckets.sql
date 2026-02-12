
-- ============================================
-- Storage バケットのセキュリティ強化
-- ============================================

-- 1. バケットのMIMEタイプ制限を設定
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'images';

UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'danger-reports';

UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'processed-images';

UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'avatars';

-- 2. ファイルサイズ制限（10MB）
UPDATE storage.buckets 
SET file_size_limit = 10485760
WHERE id IN ('images', 'danger-reports', 'processed-images', 'avatars');

-- ============================================
-- 3. 既存の汎用ポリシーを削除
-- ============================================
DROP POLICY IF EXISTS "Allow INSERT for Authenticated Users" ON storage.objects;
DROP POLICY IF EXISTS "Allow SELECT for Authenticated Users" ON storage.objects;

-- ============================================
-- 4. images バケット用ポリシー
-- ============================================

-- 誰でも閲覧可能（公開画像）
CREATE POLICY "images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'images');

-- 認証ユーザーは自分のフォルダにのみアップロード可能
CREATE POLICY "images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 自分のファイルのみ更新可能
CREATE POLICY "images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 自分のファイルのみ削除可能
CREATE POLICY "images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'images' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================
-- 5. danger-reports バケット用ポリシー
-- ============================================

-- 誰でも閲覧可能（公開レポート画像）
CREATE POLICY "danger_reports_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'danger-reports');

-- 認証ユーザーは自分のフォルダにのみアップロード可能
CREATE POLICY "danger_reports_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'danger-reports' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 自分のファイルのみ更新可能
CREATE POLICY "danger_reports_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'danger-reports' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'danger-reports' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 自分のファイルのみ削除可能
CREATE POLICY "danger_reports_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'danger-reports' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================
-- 6. processed-images バケット用ポリシー強化
-- （既存ポリシーは維持、パフォーマンス最適化のみ）
-- ============================================

DROP POLICY IF EXISTS "Allow admin uploads to processed_images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on processed_images" ON storage.objects;

-- 誰でも閲覧可能
CREATE POLICY "processed_images_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'processed-images');

-- 管理者のみアップロード可能
CREATE POLICY "processed_images_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'processed-images'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 管理者のみ更新可能
CREATE POLICY "processed_images_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'processed-images'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- 管理者のみ削除可能
CREATE POLICY "processed_images_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'processed-images'
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================
-- 7. avatars バケット用ポリシー強化
-- （既存ポリシーを最適化）
-- ============================================

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;

-- 誰でも閲覧可能
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- 認証ユーザーは自分のフォルダにのみアップロード可能
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 自分のファイルのみ更新可能
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- 自分のファイルのみ削除可能
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
;
