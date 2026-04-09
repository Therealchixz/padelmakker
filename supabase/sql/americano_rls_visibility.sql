-- =============================================================================
-- Americano: begræns synlighed — kun opretter + deltagere ser playing/completed
-- og kampresultater. Åbne turneringer (registration) synlige for alle loggede.
--
-- VIGTIGT: Policies må ikke kryds-join'e tournaments ↔ participants med RLS på,
-- det giver ofte rekursion eller tomme lister. Brug derfor SECURITY DEFINER-
-- hjælpere med row_security = off til eksistens-tjek.
-- Kør i Supabase SQL Editor (erstatter tidligere version af denne fil).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.americano_internal_tournament_status(p_tid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT t.status FROM public.americano_tournaments t WHERE t.id = p_tid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.americano_internal_tournament_creator(p_tid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT t.creator_id FROM public.americano_tournaments t WHERE t.id = p_tid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.americano_is_participant(p_tid uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.americano_participants p
    WHERE p.tournament_id = p_tid AND p.user_id = p_uid
  );
$$;

REVOKE ALL ON FUNCTION public.americano_internal_tournament_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.americano_internal_tournament_creator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.americano_is_participant(uuid, uuid) FROM PUBLIC;

DROP POLICY IF EXISTS americano_tournaments_select ON public.americano_tournaments;
CREATE POLICY americano_tournaments_select ON public.americano_tournaments
  FOR SELECT TO authenticated USING (
    status = 'registration'
    OR creator_id = (select auth.uid())
    OR public.americano_is_participant(id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_participants_select ON public.americano_participants;
CREATE POLICY americano_participants_select ON public.americano_participants
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    OR public.americano_internal_tournament_status(tournament_id) = 'registration'
    OR public.americano_internal_tournament_creator(tournament_id) = (select auth.uid())
    OR public.americano_is_participant(tournament_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_matches_select ON public.americano_matches;
CREATE POLICY americano_matches_select ON public.americano_matches
  FOR SELECT TO authenticated USING (
    public.americano_internal_tournament_creator(tournament_id) = (select auth.uid())
    OR public.americano_is_participant(tournament_id, (select auth.uid()))
  );
