-- Fix Profiles RLS Policy - Infinite Recursion Error Fix
-- profilesテーブルのRLSポリシー修正（無限再帰エラーの解決）
--
-- 問題:
--   現在のSELECTポリシーは auth.uid() = id のみ許可しているため、
--   他のテーブル（report_comments, user_pointsなど）からJOINで
--   他ユーザーのプロフィール情報を取得しようとすると、
--   "infinite recursion detected in policy for relation profiles" エラーが発生
--
-- 解決策:
--   全ユーザーがprofilesテーブルを読み取り可能にする（プロフィールは公開情報）
--   UPDATE/INSERTは引き続き自分のプロフィールのみに制限
--
-- Run this in Supabase SQL Editor
-- Supabase SQL Editorで実行してください

-- ============================================================================
-- Step 1: Drop existing SELECT policy that causes the issue
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

-- ============================================================================
-- Step 2: Create new SELECT policy that allows everyone to read all profiles
-- ============================================================================

-- 全ユーザーがプロフィールを読み取り可能（コメント表示、ランキング表示などのため）
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true);

-- ============================================================================
-- Step 3: Ensure UPDATE policy exists (users can only update their own profile)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================================
-- Step 4: Ensure INSERT policy exists (users can only insert their own profile)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Step 5: Verify RLS is enabled and policies are correct
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Verify policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';
