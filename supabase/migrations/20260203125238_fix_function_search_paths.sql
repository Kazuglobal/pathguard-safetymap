
-- =====================================================
-- FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Fix toggle_report_bookmark
ALTER FUNCTION public.toggle_report_bookmark SET search_path = public;

-- Fix toggle_report_like
ALTER FUNCTION public.toggle_report_like SET search_path = public;

-- Fix get_user_bookmarked_reports
ALTER FUNCTION public.get_user_bookmarked_reports SET search_path = public;

-- Fix get_trending_reports
ALTER FUNCTION public.get_trending_reports SET search_path = public;

-- Fix get_report_comments
ALTER FUNCTION public.get_report_comments SET search_path = public;

-- Fix hub_get_events_geojson
ALTER FUNCTION public.hub_get_events_geojson SET search_path = public;

-- Fix hub_get_features_geojson
ALTER FUNCTION public.hub_get_features_geojson SET search_path = public;

-- Fix set_comment_edited
ALTER FUNCTION public.set_comment_edited SET search_path = public;

-- Fix increment_user_points
ALTER FUNCTION public.increment_user_points SET search_path = public;

-- Fix trigger_set_timestamp
ALTER FUNCTION public.trigger_set_timestamp SET search_path = public;

-- Fix update_updated_at_column
ALTER FUNCTION public.update_updated_at_column SET search_path = public;

-- Fix get_monthly_posts
ALTER FUNCTION public.get_monthly_posts SET search_path = public;

-- Fix update_mission_progress
ALTER FUNCTION public.update_mission_progress SET search_path = public;
;
