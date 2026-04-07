-- =============================================================================
-- Valgfrit: Sørg for at authenticated kan læse elo_history for ALLE brugere
-- (nødvendigt for Kampe-kort + ranking, når I beregner ELO fra historik).
--
-- Hvis jeres policy kun tillader SELECT WHERE user_id = auth.uid(), får klienten
-- ikke andres historik — og modstanderens ELO på kampkortet falder tilbage til 1000.
--
-- Tjek nuværende policies: Dashboard → Authentication ikke; brug SQL:
--   SELECT polname, cmd, qual FROM pg_policies WHERE tablename = 'elo_history';
--
-- Eksempel-policy (tilpas til jeres setup; kan kræve at I dropper gammel policy først):
-- =============================================================================

-- DROP POLICY IF EXISTS elo_history_select_own ON public.elo_history;

-- CREATE POLICY elo_history_select_authenticated
--   ON public.elo_history
--   FOR SELECT
--   TO authenticated
--   USING (true);
