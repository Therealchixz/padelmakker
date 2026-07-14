-- App-aligned league RLS (creator + hold + admin).

DROP POLICY IF EXISTS leagues_admin_insert ON public.leagues;
DROP POLICY IF EXISTS leagues_admin_update ON public.leagues;
DROP POLICY IF EXISTS leagues_admin_delete ON public.leagues;

CREATE POLICY leagues_admin_insert ON public.leagues
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY leagues_admin_update ON public.leagues
  FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY leagues_admin_delete ON public.leagues
  FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS league_matches_insert ON public.league_matches;
CREATE POLICY league_matches_insert ON public.league_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_matches.league_id
        AND l.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS league_matches_update ON public.league_matches;
CREATE POLICY league_matches_update ON public.league_matches
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_matches.league_id
        AND l.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.league_teams t
      WHERE t.id = ANY (ARRAY[league_matches.team1_id, league_matches.team2_id])
        AND (t.player1_id = auth.uid() OR t.player2_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_matches.league_id
        AND l.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.league_teams t
      WHERE t.id = ANY (ARRAY[league_matches.team1_id, league_matches.team2_id])
        AND (t.player1_id = auth.uid() OR t.player2_id = auth.uid())
    )
  );
