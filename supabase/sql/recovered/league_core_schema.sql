-- Leagues core table (hold-baseret liga; uden senere udvidelser).

CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  season_type text NOT NULL DEFAULT 'monthly'
    CHECK (season_type IN ('weekly', 'monthly')),
  status text NOT NULL DEFAULT 'registration'
    CHECK (status IN ('registration', 'active', 'completed')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  current_round integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;

DROP POLICY IF EXISTS leagues_select ON public.leagues;
CREATE POLICY leagues_select ON public.leagues
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS leagues_creator_insert ON public.leagues;
CREATE POLICY leagues_creator_insert ON public.leagues
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS leagues_creator_update ON public.leagues;
CREATE POLICY leagues_creator_update ON public.leagues
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS leagues_creator_delete ON public.leagues;
CREATE POLICY leagues_creator_delete ON public.leagues
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_leagues_status ON public.leagues (status);
