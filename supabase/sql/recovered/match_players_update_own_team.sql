-- Players may update their own team slot on match_players.

DROP POLICY IF EXISTS match_players_update_own_team ON public.match_players;
CREATE POLICY match_players_update_own_team
  ON public.match_players
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
