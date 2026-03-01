-- 古い制限的なSELECTポリシーを削除（profiles_select_allがあれば不要）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;;
