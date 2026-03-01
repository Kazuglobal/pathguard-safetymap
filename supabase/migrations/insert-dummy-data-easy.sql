-- Easy Dummy Data Insertion Script
-- Run this in Supabase SQL Editor
-- このスクリプトをSupabase SQL Editorで実行してください

-- This script bypasses RLS by running as a superuser in SQL Editor
-- SQLエディターではスーパーユーザーとして実行されるため、RLSをバイパスします

BEGIN;

-- ============================================================================
-- Step 1: Get existing users and reports
-- ステップ1: 既存のユーザーと報告を取得
-- ============================================================================

DO $$
DECLARE
    v_user_ids uuid[];
    v_report_ids uuid[];
    v_user_id uuid;
    v_report_id uuid;
    v_platform text;
    v_comment_text text;
    v_parent_comment_id uuid;
    i int;
    j int;
    num_likes int;
    num_bookmarks int;
    num_comments int;
    num_shares int;
    inserted_count int := 0;
BEGIN
    -- Get unique user IDs from danger_reports
    SELECT ARRAY_AGG(DISTINCT user_id) INTO v_user_ids
    FROM public.danger_reports
    LIMIT 10;

    IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
        RAISE NOTICE '❌ No users found. Please create danger reports first.';
        RETURN;
    END IF;

    RAISE NOTICE '✓ Found % unique users', array_length(v_user_ids, 1);

    -- Get approved report IDs
    SELECT ARRAY_AGG(id) INTO v_report_ids
    FROM public.danger_reports
    WHERE status = 'approved'
    LIMIT 10;

    IF v_report_ids IS NULL OR array_length(v_report_ids, 1) = 0 THEN
        RAISE NOTICE '❌ No approved reports found.';
        RETURN;
    END IF;

    RAISE NOTICE '✓ Found % approved reports', array_length(v_report_ids, 1);

    -- ============================================================================
    -- Step 2: Insert Bookmarks (お気に入り)
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══ Inserting Bookmarks ═══';

    FOR i IN 1..array_length(v_report_ids, 1) LOOP
        v_report_id := v_report_ids[i];
        num_bookmarks := floor(random() * 3)::int; -- 0-2 bookmarks per report

        FOR j IN 1..num_bookmarks LOOP
            v_user_id := v_user_ids[floor(random() * array_length(v_user_ids, 1) + 1)::int];

            INSERT INTO public.report_bookmarks (user_id, report_id)
            VALUES (v_user_id, v_report_id)
            ON CONFLICT (user_id, report_id) DO NOTHING;

            inserted_count := inserted_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Inserted bookmarks';

    -- ============================================================================
    -- Step 3: Insert Likes (いいね)
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══ Inserting Likes ═══';

    FOR i IN 1..array_length(v_report_ids, 1) LOOP
        v_report_id := v_report_ids[i];
        num_likes := floor(random() * 5 + 1)::int; -- 1-5 likes per report

        FOR j IN 1..num_likes LOOP
            v_user_id := v_user_ids[floor(random() * array_length(v_user_ids, 1) + 1)::int];

            INSERT INTO public.report_likes (user_id, report_id)
            VALUES (v_user_id, v_report_id)
            ON CONFLICT (user_id, report_id) DO NOTHING;

            inserted_count := inserted_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Inserted likes';

    -- ============================================================================
    -- Step 4: Insert Comments (コメント)
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══ Inserting Comments ═══';

    FOR i IN 1..array_length(v_report_ids, 1) LOOP
        v_report_id := v_report_ids[i];
        num_comments := floor(random() * 4 + 1)::int; -- 1-4 comments per report

        FOR j IN 1..num_comments LOOP
            v_user_id := v_user_ids[floor(random() * array_length(v_user_ids, 1) + 1)::int];

            -- Random comment text
            CASE floor(random() * 10)::int
                WHEN 0 THEN v_comment_text := 'この場所は本当に危険ですね。通学路として使っている子供たちが心配です。';
                WHEN 1 THEN v_comment_text := '昨日ここを通りましたが、確かに危ないと感じました。早く改善してほしいです。';
                WHEN 2 THEN v_comment_text := '詳細な報告ありがとうございます！参考になります。';
                WHEN 3 THEN v_comment_text := '私も同じ場所で危険を感じていました。';
                WHEN 4 THEN v_comment_text := '地域で対策を考える必要がありますね。';
                WHEN 5 THEN v_comment_text := '市役所に報告したほうがいいかもしれません。';
                WHEN 6 THEN v_comment_text := '写真を見るとよくわかります。注意して通ります。';
                WHEN 7 THEN v_comment_text := 'この情報を学校にも共有します。';
                WHEN 8 THEN v_comment_text := '同じような場所が他にもありそうです。';
                ELSE v_comment_text := '改善のための具体的な提案はありますか？';
            END CASE;

            INSERT INTO public.report_comments (user_id, report_id, content)
            VALUES (v_user_id, v_report_id, v_comment_text);

            inserted_count := inserted_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Inserted comments';

    -- ============================================================================
    -- Step 5: Insert Reply Comments (返信コメント)
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══ Inserting Reply Comments ═══';

    -- Get some parent comment IDs
    FOR v_parent_comment_id IN
        SELECT id FROM public.report_comments
        WHERE parent_comment_id IS NULL
        ORDER BY random()
        LIMIT 5
    LOOP
        v_user_id := v_user_ids[floor(random() * array_length(v_user_ids, 1) + 1)::int];

        SELECT report_id INTO v_report_id
        FROM public.report_comments
        WHERE id = v_parent_comment_id;

        CASE floor(random() * 5)::int
            WHEN 0 THEN v_comment_text := 'そうですね。私も同じ意見です。';
            WHEN 1 THEN v_comment_text := '詳しい情報をありがとうございます。';
            WHEN 2 THEN v_comment_text := '確かにその通りですね。';
            WHEN 3 THEN v_comment_text := '参考になるコメントです。';
            ELSE v_comment_text := '同意します。対策が必要ですね。';
        END CASE;

        INSERT INTO public.report_comments (user_id, report_id, content, parent_comment_id)
        VALUES (v_user_id, v_report_id, v_comment_text, v_parent_comment_id);

        inserted_count := inserted_count + 1;
    END LOOP;

    RAISE NOTICE '✓ Inserted reply comments';

    -- ============================================================================
    -- Step 6: Insert Shares (シェア)
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══ Inserting Shares ═══';

    FOR i IN 1..array_length(v_report_ids, 1) LOOP
        v_report_id := v_report_ids[i];
        num_shares := floor(random() * 4)::int; -- 0-3 shares per report

        FOR j IN 1..num_shares LOOP
            v_user_id := v_user_ids[floor(random() * array_length(v_user_ids, 1) + 1)::int];

            -- Random platform
            CASE floor(random() * 4)::int
                WHEN 0 THEN v_platform := 'twitter';
                WHEN 1 THEN v_platform := 'facebook';
                WHEN 2 THEN v_platform := 'line';
                ELSE v_platform := 'clipboard';
            END CASE;

            INSERT INTO public.report_shares (user_id, report_id, platform)
            VALUES (v_user_id, v_report_id, v_platform::share_platform);

            inserted_count := inserted_count + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✓ Inserted shares';

    -- ============================================================================
    -- Summary
    -- ============================================================================
    RAISE NOTICE '';
    RAISE NOTICE '═══ Summary ═══';
    RAISE NOTICE '✓ Total items inserted: %', inserted_count;

    -- Get counts
    DECLARE
        v_bookmarks_count int;
        v_likes_count int;
        v_comments_count int;
        v_shares_count int;
    BEGIN
        SELECT COUNT(*) INTO v_bookmarks_count FROM public.report_bookmarks;
        SELECT COUNT(*) INTO v_likes_count FROM public.report_likes;
        SELECT COUNT(*) INTO v_comments_count FROM public.report_comments;
        SELECT COUNT(*) INTO v_shares_count FROM public.report_shares;

        RAISE NOTICE '📊 Current database totals:';
        RAISE NOTICE '  Bookmarks: %', v_bookmarks_count;
        RAISE NOTICE '  Likes: %', v_likes_count;
        RAISE NOTICE '  Comments: %', v_comments_count;
        RAISE NOTICE '  Shares: %', v_shares_count;
    END;

END $$;

COMMIT;

-- ============================================================================
-- Verify the data
-- データを確認
-- ============================================================================

-- Show reports with most engagement
SELECT
    dr.id,
    dr.title,
    dr.danger_type,
    COUNT(DISTINCT rl.id) as likes_count,
    COUNT(DISTINCT rb.id) as bookmarks_count,
    COUNT(DISTINCT rc.id) as comments_count,
    COUNT(DISTINCT rs.id) as shares_count
FROM public.danger_reports dr
LEFT JOIN public.report_likes rl ON dr.id = rl.report_id
LEFT JOIN public.report_bookmarks rb ON dr.id = rb.report_id
LEFT JOIN public.report_comments rc ON dr.id = rc.report_id
LEFT JOIN public.report_shares rs ON dr.id = rs.report_id
WHERE dr.status = 'approved'
GROUP BY dr.id, dr.title, dr.danger_type
ORDER BY likes_count DESC, comments_count DESC
LIMIT 10;

-- Show recent comments
SELECT
    rc.content,
    rc.created_at,
    CASE WHEN rc.parent_comment_id IS NOT NULL THEN '  ↳ Reply' ELSE 'Comment' END as type
FROM public.report_comments rc
ORDER BY rc.created_at DESC
LIMIT 10;
