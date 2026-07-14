-- League teams (2-spiller hold).

CREATE TABLE IF NOT EXISTS public.league_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  player1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player1_name text NOT NULL,
  player2_name text NOT NULL,
  player1_avatar text,
  player2_avatar text,
  elo_combined integer NOT NULL DEFAULT 2000,
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT league_teams_check CHECK (player1_id <> player2_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS league_teams_league_id_player1_id_key
  ON public.league_teams (league_id, player1_id);
CREATE UNIQUE INDEX IF NOT EXISTS league_teams_league_id_player2_id_key
  ON public.league_teams (league_id, player2_id);

CREATE INDEX IF NOT EXISTS idx_league_teams_league ON public.league_teams (league_id);
CREATE INDEX IF NOT EXISTS idx_league_teams_p1 ON public.league_teams (player1_id);
CREATE INDEX IF NOT EXISTS idx_league_teams_p2 ON public.league_teams (player2_id);

ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_teams TO authenticated;

DROP POLICY IF EXISTS league_teams_select ON public.league_teams;
CREATE POLICY league_teams_select ON public.league_teams
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS league_teams_insert ON public.league_teams;
CREATE POLICY league_teams_insert ON public.league_teams
  FOR INSERT TO authenticated
  WITH CHECK (player1_id = auth.uid());

DROP POLICY IF EXISTS league_teams_update ON public.league_teams;
CREATE POLICY league_teams_update ON public.league_teams
  FOR UPDATE TO authenticated
  USING (
    player2_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS league_teams_delete ON public.league_teams;
CREATE POLICY league_teams_delete ON public.league_teams
  FOR DELETE TO authenticated
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR public.is_admin()
  );
