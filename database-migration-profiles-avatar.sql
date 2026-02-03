-- Profiles Avatar URL Migration
-- プロフィールテーブルにavatar_urlカラムを追加するマイグレーション
-- Run this in Supabase SQL Editor
-- Supabase SQL Editorで実行してください

-- ============================================================================
-- Step 1: Add avatar_url column to profiles table
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment
COMMENT ON COLUMN public.profiles.avatar_url IS 'アバター画像のURL';

-- ============================================================================
-- Step 2: Ensure RLS policies exist for profiles table
-- ============================================================================

-- SELECT ポリシー（全ユーザーがプロフィールを読み取り可能）
-- 注意: 他のテーブル（report_comments, user_pointsなど）からJOINで
-- プロフィール情報を取得するため、全員が読み取り可能にする必要がある
-- 自分のプロフィールのみに制限すると "infinite recursion detected in policy" エラーが発生
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true);

-- UPDATE ポリシー（自分のプロフィールを更新可能）
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- INSERT ポリシー（自分のプロフィールを作成可能）
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Step 3: Verify the setup
-- ============================================================================

SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'avatar_url';
