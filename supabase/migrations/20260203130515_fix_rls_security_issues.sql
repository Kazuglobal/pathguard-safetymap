
-- ============================================
-- PathGuardian Security Fix Migration
-- RLSポリシーの強化
-- ============================================

-- 1. ai_recommendations - より安全なINSERTポリシーに置き換え
DROP POLICY IF EXISTS "ai_recommendations_insert_policy" ON public.ai_recommendations;
CREATE POLICY "ai_recommendations_insert_authenticated" ON public.ai_recommendations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- context_typeとpromptが必須
    context_type IS NOT NULL AND prompt IS NOT NULL
  );

-- 2. ai_simulations - spot_idの存在チェックを追加
DROP POLICY IF EXISTS "ai_simulations_insert_policy" ON public.ai_simulations;
CREATE POLICY "ai_simulations_insert_with_validation" ON public.ai_simulations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- spot_idが有効なdanger_spotsに存在することを確認
    EXISTS (
      SELECT 1 FROM public.danger_spots ds WHERE ds.id = spot_id
    )
    AND simulation_type IS NOT NULL
    AND storage_path IS NOT NULL
  );

-- 3. players - チーム所属の検証を追加
DROP POLICY IF EXISTS "players_insert_policy" ON public.players;
DROP POLICY IF EXISTS "players_update_policy" ON public.players;

CREATE POLICY "players_insert_with_team_validation" ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- team_idがNULLまたは有効なチームに所属
    team_id IS NULL OR EXISTS (
      SELECT 1 FROM public.teams t WHERE t.id = team_id
    )
  );

CREATE POLICY "players_update_with_validation" ON public.players
  FOR UPDATE
  TO authenticated
  USING (
    -- 既存のプレイヤーのみ更新可能
    id IS NOT NULL
  )
  WITH CHECK (
    -- team_idがNULLまたは有効なチームに所属
    team_id IS NULL OR EXISTS (
      SELECT 1 FROM public.teams t WHERE t.id = team_id
    )
  );

-- 4. spot_disaster_types - spot_idとdisaster_type_idの検証
DROP POLICY IF EXISTS "spot_disaster_types_insert_policy" ON public.spot_disaster_types;
CREATE POLICY "spot_disaster_types_insert_with_validation" ON public.spot_disaster_types
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 有効なspot_idとdisaster_type_idを確認
    EXISTS (SELECT 1 FROM public.danger_spots ds WHERE ds.id = spot_id)
    AND EXISTS (SELECT 1 FROM public.disaster_types dt WHERE dt.id = disaster_type_id)
  );

-- 5. spot_photos - spot_idの検証を追加
DROP POLICY IF EXISTS "spot_photos_insert_policy" ON public.spot_photos;
CREATE POLICY "spot_photos_insert_with_validation" ON public.spot_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 有効なspot_idを確認し、storage_pathが必須
    EXISTS (SELECT 1 FROM public.danger_spots ds WHERE ds.id = spot_id)
    AND storage_path IS NOT NULL
  );

-- 6. teams - 基本的なバリデーションを追加
DROP POLICY IF EXISTS "teams_insert_policy" ON public.teams;
DROP POLICY IF EXISTS "teams_update_policy" ON public.teams;

CREATE POLICY "teams_insert_with_validation" ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 必須フィールドの確認
    name IS NOT NULL AND LENGTH(TRIM(name)) > 0
    AND region IS NOT NULL AND LENGTH(TRIM(region)) > 0
  );

CREATE POLICY "teams_update_with_validation" ON public.teams
  FOR UPDATE
  TO authenticated
  USING (id IS NOT NULL)
  WITH CHECK (
    -- 必須フィールドの確認
    name IS NOT NULL AND LENGTH(TRIM(name)) > 0
    AND region IS NOT NULL AND LENGTH(TRIM(region)) > 0
  );

-- 7. notifications テーブルのINSERTポリシーを強化
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_own_only" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- 自分宛の通知のみ作成可能、またはシステムからの通知
    user_id IS NOT NULL AND (
      auth.uid() = user_id OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );
;
