BEGIN;

-- 1. report_comments.user_id の FK を auth.users → public.profiles に変更
--    (PostgREST がスキーマキャッシュで profiles へのリレーションを認識するために必要)

ALTER TABLE public.report_comments
  DROP CONSTRAINT IF EXISTS report_comments_user_id_fkey;

ALTER TABLE public.report_comments
  DROP CONSTRAINT IF EXISTS report_comments_user_id_profiles_fkey;

ALTER TABLE public.report_comments
  ADD CONSTRAINT report_comments_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. profiles の SELECT RLS ポリシーを復元
--    (cleanup migration で削除された profiles_select_all を追加)
--    認証ユーザーは全プロフィールを閲覧可能（コメント作者表示のため必要）

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
