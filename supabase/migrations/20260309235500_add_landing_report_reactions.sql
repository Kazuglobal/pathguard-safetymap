BEGIN;

CREATE TABLE IF NOT EXISTS public.danger_report_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    report_id uuid REFERENCES public.danger_reports(id) ON DELETE CASCADE NOT NULL,
    reaction_type text NOT NULL CHECK (reaction_type IN ('helpful', 'caution')),
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(user_id, report_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_danger_report_reactions_user_id
    ON public.danger_report_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_danger_report_reactions_report_id
    ON public.danger_report_reactions(report_id);
CREATE INDEX IF NOT EXISTS idx_danger_report_reactions_report_type
    ON public.danger_report_reactions(report_id, reaction_type);

ALTER TABLE public.danger_report_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own danger report reactions" ON public.danger_report_reactions;
CREATE POLICY "Users can view their own danger report reactions"
    ON public.danger_report_reactions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own danger report reactions" ON public.danger_report_reactions;
CREATE POLICY "Users can create their own danger report reactions"
    ON public.danger_report_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own danger report reactions" ON public.danger_report_reactions;
CREATE POLICY "Users can delete their own danger report reactions"
    ON public.danger_report_reactions FOR DELETE
    USING (auth.uid() = user_id);

COMMIT;
