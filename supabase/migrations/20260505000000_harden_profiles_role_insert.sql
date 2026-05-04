-- Prevent client-side profile creation from assigning privileged roles.
-- Admin authority must come from trusted server-side configuration or
-- service-role-managed data, never from user-writable profile input.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own_safe" ON public.profiles;

CREATE POLICY "profiles_insert_own_safe" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND email = (SELECT auth.email())
    AND COALESCE(role, 'user') <> 'admin'
  );

REVOKE INSERT ON TABLE public.profiles FROM authenticated;
REVOKE INSERT ON TABLE public.profiles FROM anon;

GRANT INSERT (id, email, display_name, full_name, avatar_url, updated_at)
  ON TABLE public.profiles TO authenticated;

COMMIT;
