
-- ============================================
-- RLSポリシーのパフォーマンス最適化
-- auth.uid() を (select auth.uid()) に変更
-- ============================================

-- ============================================
-- 1. hazard_game_sessions
-- ============================================
DROP POLICY IF EXISTS "Users can insert their own game sessions" ON public.hazard_game_sessions;
DROP POLICY IF EXISTS "Users can view their own game sessions" ON public.hazard_game_sessions;

CREATE POLICY "hazard_game_sessions_select" ON public.hazard_game_sessions
  FOR SELECT TO public
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "hazard_game_sessions_insert" ON public.hazard_game_sessions
  FOR INSERT TO public
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 2. user_badges
-- ============================================
DROP POLICY IF EXISTS "self_access_badges" ON public.user_badges;

CREATE POLICY "user_badges_all" ON public.user_badges
  FOR ALL TO public
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 3. user_points
-- ============================================
DROP POLICY IF EXISTS "self_access_points" ON public.user_points;

CREATE POLICY "user_points_all" ON public.user_points
  FOR ALL TO public
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 4. user_mission_progress
-- ============================================
DROP POLICY IF EXISTS "self_access_progress" ON public.user_mission_progress;

CREATE POLICY "user_mission_progress_all" ON public.user_mission_progress
  FOR ALL TO public
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 5. report_bookmarks
-- ============================================
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.report_bookmarks;
DROP POLICY IF EXISTS "Users can create their own bookmarks" ON public.report_bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.report_bookmarks;

CREATE POLICY "report_bookmarks_select" ON public.report_bookmarks
  FOR SELECT TO public
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "report_bookmarks_insert" ON public.report_bookmarks
  FOR INSERT TO public
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "report_bookmarks_delete" ON public.report_bookmarks
  FOR DELETE TO public
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 6. report_likes
-- ============================================
DROP POLICY IF EXISTS "Users can create their own likes" ON public.report_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.report_likes;
-- SELECT policy stays as-is (allows all to view)

CREATE POLICY "report_likes_insert" ON public.report_likes
  FOR INSERT TO public
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "report_likes_delete" ON public.report_likes
  FOR DELETE TO public
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 7. report_comments
-- ============================================
DROP POLICY IF EXISTS "Users can create their own comments" ON public.report_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.report_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.report_comments;
-- SELECT policy stays as-is (allows all to view)

CREATE POLICY "report_comments_insert" ON public.report_comments
  FOR INSERT TO public
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "report_comments_update" ON public.report_comments
  FOR UPDATE TO public
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "report_comments_delete" ON public.report_comments
  FOR DELETE TO public
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 8. report_notifications
-- ============================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.report_notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.report_notifications;

CREATE POLICY "report_notifications_select" ON public.report_notifications
  FOR SELECT TO public
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "report_notifications_update" ON public.report_notifications
  FOR UPDATE TO public
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 9. report_shares
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can create shares" ON public.report_shares;
-- SELECT policy stays as-is (allows all to view)

CREATE POLICY "report_shares_insert" ON public.report_shares
  FOR INSERT TO public
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR user_id IS NULL
  );

-- ============================================
-- 10. comments (danger_spots comments)
-- ============================================
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_update_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_policy" ON public.comments;
-- SELECT policy stays as-is

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "comments_update" ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 11. danger_spots
-- ============================================
DROP POLICY IF EXISTS "danger_spots_insert_policy" ON public.danger_spots;
DROP POLICY IF EXISTS "danger_spots_update_policy" ON public.danger_spots;
-- SELECT policy stays as-is

CREATE POLICY "danger_spots_insert" ON public.danger_spots
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "danger_spots_update" ON public.danger_spots
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================
-- 12. notifications
-- ============================================
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own_only" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NOT NULL AND (
      (SELECT auth.uid()) = user_id OR
      EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    )
  );

-- ============================================
-- 13. report_images
-- ============================================
DROP POLICY IF EXISTS "Allow admins to insert into report_images" ON public.report_images;
-- SELECT policy stays as-is

CREATE POLICY "report_images_insert" ON public.report_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
;
