-- Badges System Migration
-- バッジシステム用テーブル作成マイグレーション
-- Run this in Supabase SQL Editor
-- Supabase SQL Editorで実行してください

-- ============================================================================
-- Step 1: Create badges table (バッジマスターテーブル)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.badges (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    threshold INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.badges IS 'バッジマスターテーブル';
COMMENT ON COLUMN public.badges.id IS 'バッジID';
COMMENT ON COLUMN public.badges.name IS 'バッジ名';
COMMENT ON COLUMN public.badges.icon IS 'バッジアイコン（emoji or URL）';
COMMENT ON COLUMN public.badges.threshold IS '取得に必要なポイント数';

-- ============================================================================
-- Step 2: Create user_badges table (ユーザー取得バッジテーブル)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_badges (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

-- Add comment
COMMENT ON TABLE public.user_badges IS 'ユーザー取得バッジテーブル';
COMMENT ON COLUMN public.user_badges.user_id IS 'ユーザーID';
COMMENT ON COLUMN public.user_badges.badge_id IS 'バッジID';
COMMENT ON COLUMN public.user_badges.acquired_at IS '取得日時';

-- ============================================================================
-- Step 3: Create user_points table if not exists (ユーザーポイントテーブル)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_points (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.user_points IS 'ユーザーポイントテーブル';

-- ============================================================================
-- Step 4: Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 5: Create RLS Policies
-- ============================================================================

-- badges: 全ユーザーが読み取り可能
DROP POLICY IF EXISTS "badges_select_all" ON public.badges;
CREATE POLICY "badges_select_all" ON public.badges
    FOR SELECT USING (true);

-- user_badges: 自分のバッジのみ読み取り可能
DROP POLICY IF EXISTS "user_badges_select_own" ON public.user_badges;
CREATE POLICY "user_badges_select_own" ON public.user_badges
    FOR SELECT USING (auth.uid() = user_id);

-- user_badges: 自分のバッジのみ挿入可能
DROP POLICY IF EXISTS "user_badges_insert_own" ON public.user_badges;
CREATE POLICY "user_badges_insert_own" ON public.user_badges
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_points: 自分のポイントのみ読み取り可能
DROP POLICY IF EXISTS "user_points_select_own" ON public.user_points;
CREATE POLICY "user_points_select_own" ON public.user_points
    FOR SELECT USING (auth.uid() = user_id);

-- user_points: 自分のポイントのみ更新可能
DROP POLICY IF EXISTS "user_points_update_own" ON public.user_points;
CREATE POLICY "user_points_update_own" ON public.user_points
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- Step 6: Insert sample badges (サンプルバッジデータ)
-- ============================================================================

INSERT INTO public.badges (id, name, icon, threshold, created_at)
VALUES
    (1, '初めての一歩', '🏅', 10, now()),
    (2, '見守り隊員', '👀', 50, now()),
    (3, '安全パトロール', '🛡️', 100, now()),
    (4, 'コミュニティリーダー', '⭐', 200, now()),
    (5, 'セーフティーマスター', '🏆', 500, now()),
    (6, '報告の達人', '📝', 300, now()),
    (7, '地域の守り手', '🏠', 400, now()),
    (8, 'スーパーヒーロー', '🦸', 1000, now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    threshold = EXCLUDED.threshold;

-- Reset sequence to max id + 1
SELECT setval('badges_id_seq', (SELECT MAX(id) FROM public.badges));

-- ============================================================================
-- Step 7: Verify the setup
-- ============================================================================

SELECT 'badges table created' as status, COUNT(*) as badge_count FROM public.badges;
