-- Liga-opretter kan fjerne hold; max antal hold per liga.

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS max_teams integer;

DROP POLICY IF EXISTS league_teams_delete ON public.league_teams;
CREATE POLICY league_teams_delete ON public.league_teams
  FOR DELETE TO authenticated
  USING (
    player1_id = auth.uid()
    OR player2_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_teams.league_id
        AND l.created_by = auth.uid()
    )
  );
