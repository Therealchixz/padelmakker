-- Fjern legacy DELETE-policy der tillod leave midt i aktiv liga.
DROP POLICY IF EXISTS lteams_delete_own ON public.league_teams;
DROP POLICY IF EXISTS "lteams_delete_own" ON public.league_teams;
