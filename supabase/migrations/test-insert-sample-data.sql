-- Test Data Insertion Script
-- Run this in Supabase SQL Editor to test the gallery/feed features
-- テストデータ挿入スクリプト

BEGIN;

-- ============================================================================
-- 1. Get a test user and report
-- ============================================================================

-- まず、既存のユーザーと報告を取得
DO $$
DECLARE
    v_user_id uuid;
    v_report_id uuid;
    v_user_id_2 uuid;
    v_bookmark_count int;
    v_like_count int;
    v_comment_count int;
BEGIN
    -- 既存のユーザーを取得（最初のユーザー）
    SELECT id INTO v_user_id
    FROM auth.users
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'No users found. Please create a user first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Using user ID: %', v_user_id;

    -- 2番目のユーザーを取得（いいね/コメント用）
    SELECT id INTO v_user_id_2
    FROM auth.users
    WHERE id != v_user_id
    LIMIT 1;

    IF v_user_id_2 IS NULL THEN
        v_user_id_2 := v_user_id; -- 同じユーザーを使用
    END IF;

    RAISE NOTICE 'Using second user ID: %', v_user_id_2;

    -- 承認済みの報告を取得
    SELECT id INTO v_report_id
    FROM public.danger_reports
    WHERE status = 'approved'
    LIMIT 1;

    IF v_report_id IS NULL THEN
        RAISE NOTICE 'No approved reports found. Please create a report first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Using report ID: %', v_report_id;

    -- ============================================================================
    -- 2. Insert test bookmarks (お気に入り)
    -- ============================================================================

    INSERT INTO public.report_bookmarks (user_id, report_id)
    VALUES (v_user_id, v_report_id)
    ON CONFLICT (user_id, report_id) DO NOTHING;

    SELECT COUNT(*) INTO v_bookmark_count
    FROM public.report_bookmarks
    WHERE report_id = v_report_id;

    RAISE NOTICE '✓ Bookmarks created. Total: %', v_bookmark_count;

    -- ============================================================================
    -- 3. Insert test likes (いいね)
    -- ============================================================================

    INSERT INTO public.report_likes (user_id, report_id)
    VALUES
        (v_user_id, v_report_id),
        (v_user_id_2, v_report_id)
    ON CONFLICT (user_id, report_id) DO NOTHING;

    SELECT COUNT(*) INTO v_like_count
    FROM public.report_likes
    WHERE report_id = v_report_id;

    RAISE NOTICE '✓ Likes created. Total: %', v_like_count;

    -- ============================================================================
    -- 4. Insert test comments (コメント)
    -- ============================================================================

    -- 親コメント
    INSERT INTO public.report_comments (user_id, report_id, content)
    VALUES
        (v_user_id, v_report_id, 'この場所は本当に危険ですね。注意が必要です。'),
        (v_user_id_2, v_report_id, '昨日ここを通りましたが、確かに危ないと感じました。')
    ON CONFLICT DO NOTHING;

    -- 返信コメント（もし親コメントがあれば）
    DECLARE
        v_parent_comment_id uuid;
    BEGIN
        SELECT id INTO v_parent_comment_id
        FROM public.report_comments
        WHERE report_id = v_report_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_parent_comment_id IS NOT NULL THEN
            INSERT INTO public.report_comments (user_id, report_id, content, parent_comment_id)
            VALUES (v_user_id, v_report_id, '詳細な報告ありがとうございます！', v_parent_comment_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END;

    SELECT COUNT(*) INTO v_comment_count
    FROM public.report_comments
    WHERE report_id = v_report_id;

    RAISE NOTICE '✓ Comments created. Total: %', v_comment_count;

    -- ============================================================================
    -- 5. Insert test shares (シェア)
    -- ============================================================================

    INSERT INTO public.report_shares (user_id, report_id, platform)
    VALUES
        (v_user_id, v_report_id, 'twitter'),
        (v_user_id_2, v_report_id, 'line'),
        (v_user_id, v_report_id, 'facebook')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✓ Shares created';

    -- ============================================================================
    -- 6. Verify data was inserted
    -- ============================================================================

    RAISE NOTICE '';
    RAISE NOTICE '=== Test Data Summary ===';
    RAISE NOTICE 'Report ID: %', v_report_id;
    RAISE NOTICE 'Bookmarks: %', v_bookmark_count;
    RAISE NOTICE 'Likes: %', v_like_count;
    RAISE NOTICE 'Comments: %', v_comment_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Test data inserted successfully!';

END $$;

COMMIT;

-- ============================================================================
-- 7. Query the results
-- ============================================================================

-- View report with stats
SELECT
    dr.id,
    dr.title,
    dr.danger_type,
    dr.danger_level,
    rs.likes_count,
    rs.bookmarks_count,
    rs.comments_count,
    rs.shares_count
FROM public.danger_reports dr
LEFT JOIN public.report_stats rs ON dr.id = rs.report_id
WHERE dr.status = 'approved'
ORDER BY rs.likes_count DESC NULLS LAST
LIMIT 5;

-- View comments
SELECT
    rc.id,
    rc.content,
    rc.parent_comment_id,
    rc.is_edited,
    rc.created_at
FROM public.report_comments rc
WHERE rc.report_id IN (
    SELECT id FROM public.danger_reports WHERE status = 'approved' LIMIT 1
)
ORDER BY rc.created_at ASC;

-- View category stats
SELECT * FROM public.danger_category_stats;
