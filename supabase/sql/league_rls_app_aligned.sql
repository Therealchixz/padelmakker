-- =============================================================================
-- Liga RLS: team-baseret schema (league_teams / team1_id) — matcher PWA-koden
-- Kør i Supabase SQL Editor (idempotent).
--
-- Giver:
--   • Liga-opretter: opret/opdater egen liga, generér kampe
--   • Holdspillere: rapportere resultat på egne kampe
--   • PIN-admin (is_admin): fuld adgang
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.leagues') IS NULL OR to_regclass('public.league_matches') IS NULL THEN
    RAISE NOTICE 'Liga-tabeller findes ikke — springer over';
    RETURN;
  END IF;

  -- ── leagues ───────────────────────────────────────────────────────────────
  DROP POLICY IF EXISTS leagues_creator_insert ON public.leagues;
  CREATE POLICY leagues_creator_insert ON public.leagues
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

  DROP POLICY IF EXISTS leagues_creator_update ON public.leagues;
  CREATE POLICY leagues_creator_update ON public.leagues
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

  DROP POLICY IF EXISTS leagues_creator_delete ON public.leagues;
  CREATE POLICY leagues_creator_delete ON public.leagues
    FOR DELETE TO authenticated
    USING (created_by = auth.uid() OR public.is_admin());

  -- ── league_matches (team1_id / team2_id via league_teams) ─────────────────
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
        WHERE t.id IN (league_matches.team1_id, league_matches.team2_id)
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
        WHERE t.id IN (league_matches.team1_id, league_matches.team2_id)
          AND (t.player1_id = auth.uid() OR t.player2_id = auth.uid())
      )
    );
END $$;

NOTIFY pgrst, 'reload schema';
