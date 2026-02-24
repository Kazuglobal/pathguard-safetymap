BEGIN;

-- 1. report_comments.user_id の FK を auth.users → public.profiles に変更
--    (PostgREST がスキーマキャッシュで profiles へのリレーションを認識するために必要)
--    コメントを保持するため、profiles 削除時は user_id を NULL 化する

ALTER TABLE public.report_comments
  DROP CONSTRAINT IF EXISTS report_comments_user_id_fkey;

ALTER TABLE public.report_comments
  DROP CONSTRAINT IF EXISTS report_comments_user_id_profiles_fkey;

-- profiles に存在しない user_id は先に NULL 化して FK 追加失敗を防ぐ
UPDATE public.report_comments rc
SET user_id = NULL
WHERE rc.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = rc.user_id
  );

ALTER TABLE public.report_comments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.report_comments
  ADD CONSTRAINT report_comments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. profiles の SELECT RLS ポリシーを復元
--    (cleanup migration で削除された profiles_select_all を追加)
--    認証ユーザーは全プロフィールを閲覧可能（コメント作者表示のため必要）

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- コメント作者表示で不要な個人情報(email)はAPI公開対象から除外
REVOKE SELECT (email) ON TABLE public.profiles FROM authenticated;
REVOKE SELECT (email) ON TABLE public.profiles FROM anon;

COMMIT;
