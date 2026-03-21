-- Push Subscriptions: Web Push API サブスクリプション管理テーブル
-- 2026-03-21

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Web Push サブスクリプション情報
  endpoint text NOT NULL,  -- Push Service URL
  p256dh text NOT NULL,    -- ECDH公開鍵 (Base64URL)
  auth text NOT NULL,      -- 認証シークレット (Base64URL)

  -- 通知設定
  notification_preferences jsonb NOT NULL DEFAULT '{
    "danger_reports": true,
    "news": true,
    "magazine": true
  }'::jsonb,

  -- 重複防止用ウォーターマーク
  last_notified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, endpoint)
);

-- インデックス
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx
  ON public.push_subscriptions (endpoint);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.set_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_push_subscriptions_updated_at();

-- Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のサブスクリプションのみ参照可能
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーは自分のサブスクリプションのみ挿入可能
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のサブスクリプションのみ更新可能
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のサブスクリプションのみ削除可能
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- サービスロール (サーバー側) は全件操作可能 (プッシュ送信用)
CREATE POLICY "push_subscriptions_service_role_all"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');
