
-- ============================================
-- 外部キーインデックスの追加
-- クエリパフォーマンス向上のため
-- ============================================

-- 1. danger_reports
CREATE INDEX IF NOT EXISTS idx_danger_reports_user_id 
  ON public.danger_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_danger_reports_municipality_code 
  ON public.danger_reports(municipality_code);

-- 2. diaries
CREATE INDEX IF NOT EXISTS idx_diaries_player_id 
  ON public.diaries(player_id);

-- 3. diary_comments
CREATE INDEX IF NOT EXISTS idx_diary_comments_diary_id 
  ON public.diary_comments(diary_id);

-- 4. hub_events
CREATE INDEX IF NOT EXISTS idx_hub_events_source_id 
  ON public.hub_events(source_id);

-- 5. hub_features
CREATE INDEX IF NOT EXISTS idx_hub_features_source_id 
  ON public.hub_features(source_id);

-- 6. players
CREATE INDEX IF NOT EXISTS idx_players_team_id 
  ON public.players(team_id);

-- 7. report_images
CREATE INDEX IF NOT EXISTS idx_report_images_report_id 
  ON public.report_images(report_id);

CREATE INDEX IF NOT EXISTS idx_report_images_uploaded_by 
  ON public.report_images(uploaded_by);

-- 8. report_notifications
CREATE INDEX IF NOT EXISTS idx_report_notifications_report_id 
  ON public.report_notifications(report_id);

CREATE INDEX IF NOT EXISTS idx_report_notifications_actor_user_id 
  ON public.report_notifications(actor_user_id);

-- 9. spot_disaster_types
CREATE INDEX IF NOT EXISTS idx_spot_disaster_types_disaster_type_id 
  ON public.spot_disaster_types(disaster_type_id);

-- 10. user_badges
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id 
  ON public.user_badges(badge_id);

-- 11. user_mission_progress
CREATE INDEX IF NOT EXISTS idx_user_mission_progress_mission_id 
  ON public.user_mission_progress(mission_id);
;
