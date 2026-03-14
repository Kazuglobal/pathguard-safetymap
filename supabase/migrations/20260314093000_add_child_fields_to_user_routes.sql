ALTER TABLE public.user_routes
ADD COLUMN IF NOT EXISTS child_id text,
ADD COLUMN IF NOT EXISTS child_name text;

CREATE INDEX IF NOT EXISTS user_routes_user_child_id_idx
ON public.user_routes (user_id, child_id);
