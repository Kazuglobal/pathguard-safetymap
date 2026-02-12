
-- =====================================================
-- CRITICAL SECURITY FIXES FOR PATHGUARDIAN
-- =====================================================

-- 1. DROP problematic view that exposes auth.users
DROP VIEW IF EXISTS public.user_report_activity;

-- 2. Recreate user_report_activity without auth.users exposure
-- Using profiles table instead
CREATE OR REPLACE VIEW public.user_report_activity
WITH (security_invoker = true)
AS
SELECT 
    p.id AS user_id,
    count(DISTINCT dr.id) AS reports_created,
    count(DISTINCT rl.id) AS likes_given,
    count(DISTINCT rb.id) AS bookmarks_created,
    count(DISTINCT rc.id) AS comments_posted,
    count(DISTINCT rs.id) AS shares_made,
    max(GREATEST(
        COALESCE(dr.created_at, '1970-01-01 00:00:00+00'::timestamp with time zone), 
        COALESCE(rl.created_at, '1970-01-01 00:00:00+00'::timestamp with time zone), 
        COALESCE(rb.created_at, '1970-01-01 00:00:00+00'::timestamp with time zone), 
        COALESCE(rc.created_at, '1970-01-01 00:00:00+00'::timestamp with time zone), 
        COALESCE(rs.created_at, '1970-01-01 00:00:00+00'::timestamp with time zone)
    )) AS last_activity_at
FROM profiles p
LEFT JOIN danger_reports dr ON (p.id = dr.user_id)
LEFT JOIN report_likes rl ON (p.id = rl.user_id)
LEFT JOIN report_bookmarks rb ON (p.id = rb.user_id)
LEFT JOIN report_comments rc ON (p.id = rc.user_id)
LEFT JOIN report_shares rs ON (p.id = rs.user_id)
GROUP BY p.id;

-- 3. Fix SECURITY DEFINER views - recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_reports_with_stats;
DROP VIEW IF EXISTS public.report_stats;
DROP VIEW IF EXISTS public.danger_category_stats;

-- Recreate report_stats with SECURITY INVOKER
CREATE VIEW public.report_stats
WITH (security_invoker = true)
AS
SELECT 
    dr.id AS report_id,
    dr.danger_type,
    dr.danger_level,
    dr.status,
    dr.created_at,
    count(DISTINCT rl.id) AS likes_count,
    count(DISTINCT rb.id) AS bookmarks_count,
    count(DISTINCT rc.id) AS comments_count,
    count(DISTINCT rs.id) AS shares_count
FROM danger_reports dr
LEFT JOIN report_likes rl ON (dr.id = rl.report_id)
LEFT JOIN report_bookmarks rb ON (dr.id = rb.report_id)
LEFT JOIN report_comments rc ON (dr.id = rc.report_id)
LEFT JOIN report_shares rs ON (dr.id = rs.report_id)
GROUP BY dr.id, dr.danger_type, dr.danger_level, dr.status, dr.created_at;

-- Recreate public_reports_with_stats with SECURITY INVOKER
CREATE VIEW public.public_reports_with_stats
WITH (security_invoker = true)
AS
SELECT 
    dr.id,
    dr.user_id,
    dr.title,
    dr.description,
    dr.latitude,
    dr.longitude,
    dr.danger_type,
    dr.danger_level,
    dr.status,
    dr.image_url,
    dr.created_at,
    dr.updated_at,
    dr.processed_image_url,
    dr.processed_image_urls,
    dr.prefecture,
    dr.city,
    dr.town,
    dr.postal_code,
    dr.geocode_source,
    dr.geocoded_at,
    dr.geocode_confidence,
    dr.prefecture_code,
    dr.municipality_code,
    dr.address_hash,
    COALESCE(rs.likes_count, 0::bigint) AS likes_count,
    COALESCE(rs.bookmarks_count, 0::bigint) AS bookmarks_count,
    COALESCE(rs.comments_count, 0::bigint) AS comments_count,
    COALESCE(rs.shares_count, 0::bigint) AS shares_count
FROM danger_reports dr
LEFT JOIN report_stats rs ON (dr.id = rs.report_id)
WHERE dr.status = 'approved'::text
ORDER BY dr.created_at DESC;

-- Recreate danger_category_stats with SECURITY INVOKER
CREATE VIEW public.danger_category_stats
WITH (security_invoker = true)
AS
SELECT 
    dr.danger_type,
    count(dr.id) AS total_reports,
    count(dr.id) FILTER (WHERE dr.created_at > (now() - '7 days'::interval)) AS weekly_reports,
    count(dr.id) FILTER (WHERE dr.created_at > (now() - '30 days'::interval)) AS monthly_reports,
    avg(dr.danger_level) AS avg_danger_level,
    max(dr.created_at) AS latest_report_at,
    count(DISTINCT rl.user_id) AS unique_likers,
    count(DISTINCT rb.user_id) AS unique_bookmarkers,
    count(DISTINCT rc.user_id) AS unique_commenters
FROM danger_reports dr
LEFT JOIN report_likes rl ON (dr.id = rl.report_id)
LEFT JOIN report_bookmarks rb ON (dr.id = rb.report_id)
LEFT JOIN report_comments rc ON (dr.id = rc.report_id)
WHERE dr.status = 'approved'::text
GROUP BY dr.danger_type;

-- 4. Enable RLS on tables that don't have it
ALTER TABLE public.hub_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_events ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for hub tables (public read, admin write)
CREATE POLICY "hub_sources_select_policy" ON public.hub_sources
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "hub_features_select_policy" ON public.hub_features
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "hub_events_select_policy" ON public.hub_events
    FOR SELECT TO anon, authenticated
    USING (true);

-- Admin policies for hub tables (service_role only)
CREATE POLICY "hub_sources_insert_policy" ON public.hub_sources
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "hub_sources_update_policy" ON public.hub_sources
    FOR UPDATE TO service_role
    USING (true);

CREATE POLICY "hub_sources_delete_policy" ON public.hub_sources
    FOR DELETE TO service_role
    USING (true);

CREATE POLICY "hub_features_insert_policy" ON public.hub_features
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "hub_features_update_policy" ON public.hub_features
    FOR UPDATE TO service_role
    USING (true);

CREATE POLICY "hub_features_delete_policy" ON public.hub_features
    FOR DELETE TO service_role
    USING (true);

CREATE POLICY "hub_events_insert_policy" ON public.hub_events
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "hub_events_update_policy" ON public.hub_events
    FOR UPDATE TO service_role
    USING (true);

CREATE POLICY "hub_events_delete_policy" ON public.hub_events
    FOR DELETE TO service_role
    USING (true);

-- Note: spatial_ref_sys is a PostGIS system table, we'll handle it separately
;
