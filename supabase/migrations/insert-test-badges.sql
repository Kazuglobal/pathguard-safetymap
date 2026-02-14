-- Test Environment Setup Script
-- テスト環境セットアップスクリプト
-- Run this in Supabase SQL Editor before running E2E tests
-- E2Eテスト実行前にSupabase SQL Editorで実行してください

-- ============================================================================
-- IMPORTANT: Create Test User in Supabase Dashboard FIRST!
-- 重要: まずSupabaseダッシュボードでテストユーザーを作成してください！
-- 
-- 1. Go to Authentication > Users > Add User
-- 2. Email: user@test.com
-- 3. Password: testpassword123
-- 4. Auto Confirm User: ON
-- ============================================================================

-- ============================================================================
-- Step 1: Insert Badges (バッジマスターデータ)
-- ============================================================================

-- Insert sample badges
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

-- ============================================================================
-- Step 2: Assign some badges to the test user (after user creation)
-- ============================================================================

-- Get the test user's ID from auth.users table
DO $$
DECLARE
    v_test_user_id uuid;
BEGIN
    -- Find the test user by email
    SELECT id INTO v_test_user_id
    FROM auth.users
    WHERE email = 'user@test.com'
    LIMIT 1;
    
    IF v_test_user_id IS NULL THEN
        RAISE NOTICE '⚠️ Test user (user@test.com) not found. Please create the user in Supabase Dashboard first.';
        RETURN;
    END IF;
    
    RAISE NOTICE '✓ Found test user: %', v_test_user_id;
    
    -- Create profile if not exists
    INSERT INTO public.profiles (id, display_name, created_at)
    VALUES (v_test_user_id, 'Test User', now())
    ON CONFLICT (id) DO NOTHING;
    
    -- Initialize user points if not exists
    INSERT INTO public.user_points (user_id, points, level)
    VALUES (v_test_user_id, 150, 3)
    ON CONFLICT (user_id) DO UPDATE SET points = 150, level = 3;
    
    -- Assign badges 1 and 2 to the test user (they have threshold 10 and 50)
    INSERT INTO public.user_badges (user_id, badge_id, acquired_at)
    VALUES 
        (v_test_user_id, 1, now() - interval '10 days'),
        (v_test_user_id, 2, now() - interval '5 days'),
        (v_test_user_id, 3, now() - interval '1 day')
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    
    RAISE NOTICE '✓ Assigned 3 badges to test user';
    RAISE NOTICE '✓ Test environment setup complete!';
END $$;

-- ============================================================================
-- Step 3: Verify the setup
-- ============================================================================

-- Show all badges
SELECT id, name, icon, threshold FROM public.badges ORDER BY threshold;

-- Show user badges (if test user exists)
SELECT 
    ub.user_id,
    b.name as badge_name,
    b.icon,
    ub.acquired_at
FROM public.user_badges ub
JOIN public.badges b ON ub.badge_id = b.id
JOIN auth.users u ON ub.user_id = u.id
WHERE u.email = 'user@test.com';
