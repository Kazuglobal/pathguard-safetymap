-- API使用量追跡のためのマイグレーション
-- api_usage_logs テーブルと api_budget_settings テーブルを作成
-- Supabase SQL Editor で実行してください

BEGIN;

-- ============================================================================
-- Step 1: api_usage_logs テーブル作成
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_provider text NOT NULL,
  api_endpoint text NOT NULL,
  model_name text,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  request_count integer DEFAULT 1,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider ON public.api_usage_logs (api_provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider_date ON public.api_usage_logs (api_provider, created_at);

-- RLS有効化
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- INSERT は supabaseAdmin (service role) のみ。service role は RLS をバイパスするためポリシー不要。

-- 管理者のみ読み取り可能
DROP POLICY IF EXISTS "api_usage_logs_admin_select" ON public.api_usage_logs;
CREATE POLICY "api_usage_logs_admin_select" ON public.api_usage_logs
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );

-- ============================================================================
-- Step 2: api_budget_settings テーブル作成
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_budget_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_provider text NOT NULL UNIQUE,
  monthly_budget_usd numeric(10,2) DEFAULT 0,
  alert_threshold_percent integer DEFAULT 80,
  updated_at timestamptz DEFAULT now()
);

-- RLS有効化
ALTER TABLE public.api_budget_settings ENABLE ROW LEVEL SECURITY;

-- 管理者のみ読み書き可能
DROP POLICY IF EXISTS "api_budget_settings_admin_select" ON public.api_budget_settings;
CREATE POLICY "api_budget_settings_admin_select" ON public.api_budget_settings
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );

DROP POLICY IF EXISTS "api_budget_settings_admin_update" ON public.api_budget_settings;
CREATE POLICY "api_budget_settings_admin_update" ON public.api_budget_settings
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    );

-- デフォルト予算設定を挿入
INSERT INTO public.api_budget_settings (api_provider, monthly_budget_usd, alert_threshold_percent)
VALUES
  ('gemini', 50.00, 80),
  ('openai', 30.00, 80),
  ('mapbox', 20.00, 80)
ON CONFLICT (api_provider) DO NOTHING;

-- ============================================================================
-- Step 3: updated_at 自動更新トリガー
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_api_budget_settings_updated_at
  BEFORE UPDATE ON public.api_budget_settings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMIT;
