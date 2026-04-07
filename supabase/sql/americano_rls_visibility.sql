-- =============================================================================
-- Americano: begræns synlighed — kun opretter + deltagere ser playing/completed
-- og kampresultater. Åbne turneringer (registration) forbliver synlige for alle
-- loggede (så man kan finde og tilmelde sig).
-- Kør i Supabase SQL Editor.
-- =============================================================================

DROP POLICY IF EXISTS americano_tournaments_select ON public.americano_tournaments;
CREATE POLICY americano_tournaments_select ON public.americano_tournaments
  FOR SELECT TO authenticated USING (
    status = 'registration'
    OR creator_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.americano_participants p
      WHERE p.tournament_id = americano_tournaments.id
        AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS americano_participants_select ON public.americano_participants;
CREATE POLICY americano_participants_select ON public.americano_participants
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = americano_participants.tournament_id
        AND (
          t.status = 'registration'
          OR t.creator_id = (select auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.americano_participants p2
      WHERE p2.tournament_id = americano_participants.tournament_id
        AND p2.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS americano_matches_select ON public.americano_matches;
CREATE POLICY americano_matches_select ON public.americano_matches
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = americano_matches.tournament_id
        AND t.creator_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.americano_participants p
      WHERE p.tournament_id = americano_matches.tournament_id
        AND p.user_id = (select auth.uid())
    )
  );
