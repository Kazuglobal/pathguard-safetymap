-- Migration: Add report gallery and social feed features
-- Run this in your Supabase SQL editor or via supabase db push

BEGIN;

-- ============================================================================
-- 1. Report Bookmarks (お気に入り)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_bookmarks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    report_id uuid REFERENCES public.danger_reports(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_bookmarks_user_id
    ON public.report_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_report_bookmarks_report_id
    ON public.report_bookmarks(report_id);
CREATE INDEX IF NOT EXISTS idx_report_bookmarks_created_at
    ON public.report_bookmarks(created_at DESC);

-- RLS for bookmarks
ALTER TABLE public.report_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookmarks" ON public.report_bookmarks;
CREATE POLICY "Users can view their own bookmarks"
    ON public.report_bookmarks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own bookmarks" ON public.report_bookmarks;
CREATE POLICY "Users can create their own bookmarks"
    ON public.report_bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON public.report_bookmarks;
CREATE POLICY "Users can delete their own bookmarks"
    ON public.report_bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 2. Report Likes (いいね)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    report_id uuid REFERENCES public.danger_reports(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_likes_user_id
    ON public.report_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_report_likes_report_id
    ON public.report_likes(report_id);
CREATE INDEX IF NOT EXISTS idx_report_likes_created_at
    ON public.report_likes(created_at DESC);

-- RLS for likes
ALTER TABLE public.report_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all likes" ON public.report_likes;
CREATE POLICY "Users can view all likes"
    ON public.report_likes FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can create their own likes" ON public.report_likes;
CREATE POLICY "Users can create their own likes"
    ON public.report_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own likes" ON public.report_likes;
CREATE POLICY "Users can delete their own likes"
    ON public.report_likes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Report Comments (コメント)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    report_id uuid REFERENCES public.danger_reports(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
    parent_comment_id uuid REFERENCES public.report_comments(id) ON DELETE CASCADE,
    is_edited boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_report_comments_user_id
    ON public.report_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_report_id
    ON public.report_comments(report_id);
CREATE INDEX IF NOT EXISTS idx_report_comments_created_at
    ON public.report_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_comments_parent_id
    ON public.report_comments(parent_comment_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_report_comments_updated_at ON public.report_comments;
CREATE TRIGGER update_report_comments_updated_at
    BEFORE UPDATE ON public.report_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set is_edited flag
CREATE OR REPLACE FUNCTION set_comment_edited()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.is_edited = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_report_comment_edited ON public.report_comments;
CREATE TRIGGER set_report_comment_edited
    BEFORE UPDATE ON public.report_comments
    FOR EACH ROW EXECUTE FUNCTION set_comment_edited();

-- RLS for comments
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all comments" ON public.report_comments;
CREATE POLICY "Users can view all comments"
    ON public.report_comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can create their own comments" ON public.report_comments;
CREATE POLICY "Users can create their own comments"
    ON public.report_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.report_comments;
CREATE POLICY "Users can update their own comments"
    ON public.report_comments FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.report_comments;
CREATE POLICY "Users can delete their own comments"
    ON public.report_comments FOR DELETE
    USING (auth.uid() = user_id);

COMMIT;

-- Continuation of migration file...

BEGIN;

-- ============================================================================
-- 4. Report Shares (シェア追跡)
-- ============================================================================

DO $$
BEGIN
    CREATE TYPE public.share_platform AS ENUM ('twitter', 'facebook', 'line', 'clipboard', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;

CREATE TABLE IF NOT EXISTS public.report_shares (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    report_id uuid REFERENCES public.danger_reports(id) ON DELETE CASCADE NOT NULL,
    platform public.share_platform NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_report_shares_user_id
    ON public.report_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_report_id
    ON public.report_shares(report_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_platform
    ON public.report_shares(platform);
CREATE INDEX IF NOT EXISTS idx_report_shares_created_at
    ON public.report_shares(created_at DESC);

-- RLS for shares
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shares count" ON public.report_shares;
CREATE POLICY "Anyone can view shares count"
    ON public.report_shares FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create shares" ON public.report_shares;
CREATE POLICY "Authenticated users can create shares"
    ON public.report_shares FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- 5. Report Statistics View (統計情報ビュー)
-- ============================================================================

CREATE OR REPLACE VIEW public.report_stats AS
SELECT
    dr.id as report_id,
    dr.danger_type,
    dr.danger_level,
    dr.status,
    dr.created_at,
    COUNT(DISTINCT rl.id) as likes_count,
    COUNT(DISTINCT rb.id) as bookmarks_count,
    COUNT(DISTINCT rc.id) as comments_count,
    COUNT(DISTINCT rs.id) as shares_count
FROM public.danger_reports dr
LEFT JOIN public.report_likes rl ON dr.id = rl.report_id
LEFT JOIN public.report_bookmarks rb ON dr.id = rb.report_id
LEFT JOIN public.report_comments rc ON dr.id = rc.report_id
LEFT JOIN public.report_shares rs ON dr.id = rs.report_id
GROUP BY dr.id, dr.danger_type, dr.danger_level, dr.status, dr.created_at;

-- ============================================================================
-- 6. Public Reports View (公開報告ビュー)
-- ============================================================================

CREATE OR REPLACE VIEW public.public_reports_with_stats AS
SELECT
    dr.*,
    COALESCE(rs.likes_count, 0) as likes_count,
    COALESCE(rs.bookmarks_count, 0) as bookmarks_count,
    COALESCE(rs.comments_count, 0) as comments_count,
    COALESCE(rs.shares_count, 0) as shares_count
FROM public.danger_reports dr
LEFT JOIN public.report_stats rs ON dr.id = rs.report_id
WHERE dr.status = 'approved'
ORDER BY dr.created_at DESC;

COMMIT;

-- Continuation...

BEGIN;

-- ============================================================================
-- 7. Helper Functions (FIXED RETURN TYPES)
-- ============================================================================

-- Function to toggle bookmark
DROP FUNCTION IF EXISTS toggle_report_bookmark(uuid, uuid);
CREATE OR REPLACE FUNCTION toggle_report_bookmark(
    p_user_id uuid,
    p_report_id uuid
)
RETURNS boolean AS $$
DECLARE
    v_exists boolean;
BEGIN
    -- Check if bookmark exists
    SELECT EXISTS(
        SELECT 1 FROM public.report_bookmarks
        WHERE user_id = p_user_id AND report_id = p_report_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Remove bookmark
        DELETE FROM public.report_bookmarks
        WHERE user_id = p_user_id AND report_id = p_report_id;
        RETURN false;
    ELSE
        -- Add bookmark
        INSERT INTO public.report_bookmarks (user_id, report_id)
        VALUES (p_user_id, p_report_id);
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle like
DROP FUNCTION IF EXISTS toggle_report_like(uuid, uuid);
CREATE OR REPLACE FUNCTION toggle_report_like(
    p_user_id uuid,
    p_report_id uuid
)
RETURNS boolean AS $$
DECLARE
    v_exists boolean;
BEGIN
    -- Check if like exists
    SELECT EXISTS(
        SELECT 1 FROM public.report_likes
        WHERE user_id = p_user_id AND report_id = p_report_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Remove like
        DELETE FROM public.report_likes
        WHERE user_id = p_user_id AND report_id = p_report_id;
        RETURN false;
    ELSE
        -- Add like
        INSERT INTO public.report_likes (user_id, report_id)
        VALUES (p_user_id, p_report_id);
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's bookmarked reports (FIXED)
DROP FUNCTION IF EXISTS get_user_bookmarked_reports(uuid);
CREATE OR REPLACE FUNCTION get_user_bookmarked_reports(p_user_id uuid)
RETURNS SETOF json AS $$
BEGIN
    RETURN QUERY
    SELECT row_to_json(t) FROM (
        SELECT
            dr.id,
            dr.title,
            dr.description,
            dr.latitude,
            dr.longitude,
            dr.danger_type,
            dr.danger_level,
            dr.image_url,
            dr.created_at,
            rb.created_at as bookmarked_at
        FROM public.danger_reports dr
        INNER JOIN public.report_bookmarks rb ON dr.id = rb.report_id
        WHERE rb.user_id = p_user_id
        AND dr.status = 'approved'
        ORDER BY rb.created_at DESC
    ) t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trending reports (FIXED)
DROP FUNCTION IF EXISTS get_trending_reports(integer, integer);
CREATE OR REPLACE FUNCTION get_trending_reports(
    p_limit integer DEFAULT 10,
    p_days integer DEFAULT 7
)
RETURNS SETOF json AS $$
BEGIN
    RETURN QUERY
    SELECT row_to_json(t) FROM (
        SELECT
            dr.id,
            dr.title,
            dr.description,
            dr.latitude,
            dr.longitude,
            dr.danger_type,
            dr.danger_level,
            dr.image_url,
            dr.created_at,
            (COUNT(DISTINCT rl.id) * 1.0 +
             COUNT(DISTINCT rb.id) * 1.5 +
             COUNT(DISTINCT rc.id) * 2.0 +
             COUNT(DISTINCT rs.id) * 0.5) as engagement_score
        FROM public.danger_reports dr
        LEFT JOIN public.report_likes rl ON dr.id = rl.report_id
            AND rl.created_at > now() - (p_days || ' days')::interval
        LEFT JOIN public.report_bookmarks rb ON dr.id = rb.report_id
            AND rb.created_at > now() - (p_days || ' days')::interval
        LEFT JOIN public.report_comments rc ON dr.id = rc.report_id
            AND rc.created_at > now() - (p_days || ' days')::interval
        LEFT JOIN public.report_shares rs ON dr.id = rs.report_id
            AND rs.created_at > now() - (p_days || ' days')::interval
        WHERE dr.status = 'approved'
        AND dr.created_at > now() - (p_days || ' days')::interval
        GROUP BY dr.id, dr.title, dr.description, dr.latitude, dr.longitude,
                 dr.danger_type, dr.danger_level, dr.image_url, dr.created_at
        ORDER BY engagement_score DESC
        LIMIT p_limit
    ) t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get report comments
DROP FUNCTION IF EXISTS get_report_comments(uuid);
CREATE OR REPLACE FUNCTION get_report_comments(p_report_id uuid)
RETURNS SETOF json AS $$
BEGIN
    RETURN QUERY
    SELECT row_to_json(t) FROM (
        SELECT
            rc.id,
            rc.user_id,
            rc.content,
            rc.parent_comment_id,
            rc.is_edited,
            rc.created_at,
            rc.updated_at
        FROM public.report_comments rc
        WHERE rc.report_id = p_report_id
        ORDER BY rc.created_at ASC
    ) t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Final part...

BEGIN;

-- ============================================================================
-- 8. Category Statistics
-- ============================================================================

CREATE OR REPLACE VIEW public.danger_category_stats AS
SELECT
    dr.danger_type,
    COUNT(dr.id) as total_reports,
    COUNT(dr.id) FILTER (WHERE dr.created_at > now() - interval '7 days') as weekly_reports,
    COUNT(dr.id) FILTER (WHERE dr.created_at > now() - interval '30 days') as monthly_reports,
    AVG(dr.danger_level) as avg_danger_level,
    MAX(dr.created_at) as latest_report_at,
    COUNT(DISTINCT rl.user_id) as unique_likers,
    COUNT(DISTINCT rb.user_id) as unique_bookmarkers,
    COUNT(DISTINCT rc.user_id) as unique_commenters
FROM public.danger_reports dr
LEFT JOIN public.report_likes rl ON dr.id = rl.report_id
LEFT JOIN public.report_bookmarks rb ON dr.id = rb.report_id
LEFT JOIN public.report_comments rc ON dr.id = rc.report_id
WHERE dr.status = 'approved'
GROUP BY dr.danger_type;

-- ============================================================================
-- 9. User Activity View
-- ============================================================================

CREATE OR REPLACE VIEW public.user_report_activity AS
SELECT
    u.id as user_id,
    COUNT(DISTINCT dr.id) as reports_created,
    COUNT(DISTINCT rl.id) as likes_given,
    COUNT(DISTINCT rb.id) as bookmarks_created,
    COUNT(DISTINCT rc.id) as comments_posted,
    COUNT(DISTINCT rs.id) as shares_made,
    MAX(GREATEST(
        COALESCE(dr.created_at, '1970-01-01'::timestamptz),
        COALESCE(rl.created_at, '1970-01-01'::timestamptz),
        COALESCE(rb.created_at, '1970-01-01'::timestamptz),
        COALESCE(rc.created_at, '1970-01-01'::timestamptz),
        COALESCE(rs.created_at, '1970-01-01'::timestamptz)
    )) as last_activity_at
FROM auth.users u
LEFT JOIN public.danger_reports dr ON u.id = dr.user_id
LEFT JOIN public.report_likes rl ON u.id = rl.user_id
LEFT JOIN public.report_bookmarks rb ON u.id = rb.user_id
LEFT JOIN public.report_comments rc ON u.id = rc.user_id
LEFT JOIN public.report_shares rs ON u.id = rs.user_id
GROUP BY u.id;

-- ============================================================================
-- 10. Notification System (Optional - for future implementation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    report_id uuid REFERENCES public.danger_reports(id) ON DELETE CASCADE NOT NULL,
    notification_type text NOT NULL CHECK (notification_type IN ('like', 'comment', 'share', 'bookmark')),
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_report_notifications_user_id
    ON public.report_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_report_notifications_is_read
    ON public.report_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_report_notifications_created_at
    ON public.report_notifications(created_at DESC);

ALTER TABLE public.report_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.report_notifications;
CREATE POLICY "Users can view their own notifications"
    ON public.report_notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.report_notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.report_notifications FOR UPDATE
    USING (auth.uid() = user_id);

COMMIT;

-- Migration complete!
-- テーブル作成完了！
