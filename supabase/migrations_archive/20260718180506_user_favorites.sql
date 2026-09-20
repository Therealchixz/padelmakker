-- Cloud-favoritter (makkere) — spejler localStorage pm_favorites_*

CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  favorite_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_favorites_no_self CHECK (user_id <> favorite_id),
  CONSTRAINT user_favorites_pkey PRIMARY KEY (user_id, favorite_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_favorite
  ON public.user_favorites (favorite_id);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_favorites_select_own ON public.user_favorites;
CREATE POLICY user_favorites_select_own ON public.user_favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_favorites_insert_own ON public.user_favorites;
CREATE POLICY user_favorites_insert_own ON public.user_favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND favorite_id <> auth.uid()
    AND NOT public.is_banned()
  );

DROP POLICY IF EXISTS user_favorites_delete_own ON public.user_favorites;
CREATE POLICY user_favorites_delete_own ON public.user_favorites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.user_favorites TO authenticated;
