
-- =====================================================
-- ADD RLS POLICIES FOR TABLES WITHOUT POLICIES
-- =====================================================

-- ai_recommendations policies
CREATE POLICY "ai_recommendations_select_policy" ON public.ai_recommendations
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "ai_recommendations_insert_policy" ON public.ai_recommendations
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ai_simulations policies
CREATE POLICY "ai_simulations_select_policy" ON public.ai_simulations
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "ai_simulations_insert_policy" ON public.ai_simulations
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- comments policies (allow users to see all, create/edit own)
CREATE POLICY "comments_select_policy" ON public.comments
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "comments_insert_policy" ON public.comments
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update_policy" ON public.comments
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "comments_delete_policy" ON public.comments
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- danger_spots policies (public read, authenticated write)
CREATE POLICY "danger_spots_select_policy" ON public.danger_spots
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "danger_spots_insert_policy" ON public.danger_spots
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "danger_spots_update_policy" ON public.danger_spots
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

-- diaries policies (owner only)
CREATE POLICY "diaries_select_policy" ON public.diaries
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "diaries_insert_policy" ON public.diaries
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "diaries_update_policy" ON public.diaries
    FOR UPDATE TO authenticated
    USING (true);

-- diary_comments policies
CREATE POLICY "diary_comments_select_policy" ON public.diary_comments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "diary_comments_insert_policy" ON public.diary_comments
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- disaster_types policies (reference data - read only for all)
CREATE POLICY "disaster_types_select_policy" ON public.disaster_types
    FOR SELECT TO anon, authenticated
    USING (true);

-- missions policies (reference data - read only for all)
CREATE POLICY "missions_select_policy" ON public.missions
    FOR SELECT TO anon, authenticated
    USING (true);

-- notifications policies (user sees own only)
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

-- players policies
CREATE POLICY "players_select_policy" ON public.players
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "players_insert_policy" ON public.players
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "players_update_policy" ON public.players
    FOR UPDATE TO authenticated
    USING (true);

-- spot_disaster_types policies (public read)
CREATE POLICY "spot_disaster_types_select_policy" ON public.spot_disaster_types
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "spot_disaster_types_insert_policy" ON public.spot_disaster_types
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- spot_photos policies (public read)
CREATE POLICY "spot_photos_select_policy" ON public.spot_photos
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "spot_photos_insert_policy" ON public.spot_photos
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- teams policies
CREATE POLICY "teams_select_policy" ON public.teams
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "teams_insert_policy" ON public.teams
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "teams_update_policy" ON public.teams
    FOR UPDATE TO authenticated
    USING (true);
;
