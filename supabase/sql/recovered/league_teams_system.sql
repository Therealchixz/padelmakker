-- League matches (hold vs hold).

CREATE TABLE IF NOT EXISTS public.league_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  team1_id uuid NOT NULL REFERENCES public.league_teams(id) ON DELETE CASCADE,
  team2_id uuid REFERENCES public.league_teams(id) ON DELETE CASCADE,
  winner_id uuid REFERENCES public.league_teams(id),
  score_text text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reported')),
  reported_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_matches_league ON public.league_matches (league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status ON public.league_matches (status);

ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_matches TO authenticated;

DROP POLICY IF EXISTS league_matches_select ON public.league_matches;
CREATE POLICY league_matches_select ON public.league_matches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS league_matches_insert ON public.league_matches;
CREATE POLICY league_matches_insert ON public.league_matches
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS league_matches_update ON public.league_matches;
CREATE POLICY league_matches_update ON public.league_matches
  FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Fjern legacy participant-baseret skema hvis det findes fra tidligere iterationer.
DROP TABLE IF EXISTS public.league_participants CASCADE;
