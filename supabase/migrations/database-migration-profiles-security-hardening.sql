-- Profiles security hardening migration
-- `profiles.role` の自己昇格を防止し、最小権限原則に合わせて更新可能カラムを制限する

BEGIN;

-- RLS を有効化（冪等）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- UPDATE ポリシーを USING + WITH CHECK で明示し、
-- 「自分の行のみ更新可能」を更新後データにも適用する
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 最小権限化:
-- 認証ユーザー/匿名ユーザーは role/email/id を更新できない
REVOKE UPDATE (role, email, id) ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE (role, email, id) ON TABLE public.profiles FROM anon;

-- プロフィール編集で必要なカラムのみ更新許可
GRANT UPDATE (display_name, full_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;

COMMIT;
