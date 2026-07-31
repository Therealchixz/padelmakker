-- =============================================================================
-- Oprydning: permissive legacy RLS på public.league_matches
-- Kør i Supabase → SQL Editor (idempotent).
-- Fjerner policies der gav INSERT/UPDATE med WITH CHECK/USING (true) og
-- omgik league_matches_insert / league_matches_update (is_admin()).
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.league_matches') IS NULL THEN
    RAISE NOTICE 'public.league_matches findes ikke — springer over';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS lmatches_insert_auth ON public.league_matches;
  DROP POLICY IF EXISTS lmatches_update_auth ON public.league_matches;
END $$;
