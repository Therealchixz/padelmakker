-- =============================================================================
-- Realtime: sørg for at match_results + notifications publiceres til klienter
-- =============================================================================
-- Bug:
--   Pop-up'en der tvinger spillere til at bekræfte/afvise et indsendt
--   resultat opdaterede ikke før brugeren genstartede appen.  Årsagen er
--   at match_results ikke er i `supabase_realtime` publication, så
--   klientens WebSocket aldrig modtog INSERT-eventet.
--
--   Frontend håndterer nu både notifications-eventet (det primære signal)
--   og match_results, så hvis bare ÉN af de to er i publication, virker
--   live-opdateringen.  Dette script sikrer begge er der.
--
-- Idempotent.  Kør i Supabase → SQL Editor → Run.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'match_results'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results';
  END IF;
END $$;


-- =============================================================================
-- VERIFICERING
-- =============================================================================
/*
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('match_results','notifications');
*/
