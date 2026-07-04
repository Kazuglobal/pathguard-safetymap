-- N2対策: profiles.role の自己昇格を防ぐ列レベル権限の縛りを
-- versioned migration として正式に適用する。
-- (旧: database-migration-profiles-security-hardening.sql は手動適用ファイルで
--  本番へ未適用の可能性があったため、こちらを正とする)

BEGIN;

-- 最小権限化:
-- 認証ユーザー/匿名ユーザーは role/email/id を更新できない
REVOKE UPDATE (role, email, id) ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE (role, email, id) ON TABLE public.profiles FROM anon;

-- プロフィール編集で必要なカラムのみ更新許可
GRANT UPDATE (display_name, full_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;

COMMIT;
