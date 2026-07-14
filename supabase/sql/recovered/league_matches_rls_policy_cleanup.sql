-- Fjern forældede / duplikerede league_matches-policies.

DROP POLICY IF EXISTS lmatches_read_all ON public.league_matches;
DROP POLICY IF EXISTS lmatches_delete_admin ON public.league_matches;
DROP POLICY IF EXISTS league_matches_delete ON public.league_matches;

DROP POLICY IF EXISTS lteams_read_all ON public.league_teams;
DROP POLICY IF EXISTS lteams_insert_self ON public.league_teams;
DROP POLICY IF EXISTS lteams_delete_own ON public.league_teams;
DROP POLICY IF EXISTS lteams_update_admin ON public.league_teams;

DROP POLICY IF EXISTS leagues_read_all ON public.leagues;
DROP POLICY IF EXISTS leagues_insert_admin ON public.leagues;
DROP POLICY IF EXISTS leagues_update_admin ON public.leagues;
DROP POLICY IF EXISTS leagues_delete_admin ON public.leagues;
