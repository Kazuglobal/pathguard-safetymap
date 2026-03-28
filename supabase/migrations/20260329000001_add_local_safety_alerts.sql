BEGIN;

-- 地域安全アラートテーブル
-- 声かけ事案・不審者情報などのローカルリアルタイム情報を格納する
CREATE TABLE IF NOT EXISTS public.local_safety_alerts (
    id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    prefecture       text        NOT NULL,
    city             text,
    category         text        NOT NULL
                       CHECK (category IN ('suspicious', 'voice_call', 'following', 'other')),
    description      text        NOT NULL,
    source_url       text,
    occurred_at      timestamptz NOT NULL,
    push_notified_at timestamptz,
    created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),

    -- prefecture + city + occurred_at の組み合わせで重複排除
    UNIQUE (prefecture, city, occurred_at)
);

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS idx_local_safety_alerts_prefecture
    ON public.local_safety_alerts (prefecture);

CREATE INDEX IF NOT EXISTS idx_local_safety_alerts_occurred_at
    ON public.local_safety_alerts (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_safety_alerts_category
    ON public.local_safety_alerts (category);

-- 未通知アラートの高速取得（push_notified_at IS NULL の部分インデックス）
CREATE INDEX IF NOT EXISTS idx_local_safety_alerts_push_notified
    ON public.local_safety_alerts (push_notified_at)
    WHERE push_notified_at IS NULL;

-- RLS 有効化
ALTER TABLE public.local_safety_alerts ENABLE ROW LEVEL SECURITY;

-- 公開情報のため全員読み取り可
DROP POLICY IF EXISTS "Anyone can view local_safety_alerts"
    ON public.local_safety_alerts;
CREATE POLICY "Anyone can view local_safety_alerts"
    ON public.local_safety_alerts FOR SELECT
    USING (true);

-- Cron（サービスロール）のみ書き込み可
DROP POLICY IF EXISTS "Service role can insert local_safety_alerts"
    ON public.local_safety_alerts;
CREATE POLICY "Service role can insert local_safety_alerts"
    ON public.local_safety_alerts FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update local_safety_alerts"
    ON public.local_safety_alerts;
CREATE POLICY "Service role can update local_safety_alerts"
    ON public.local_safety_alerts FOR UPDATE
    TO service_role
    USING (true);

COMMIT;
