-- =============================================================================
-- Americano: Fiks synlighed (RLS) og tilføj 'Turneringer spillet' stat
-- =============================================================================

-- 1. Tilføj kolonne til antal spillede turneringer
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS americano_played integer NOT NULL DEFAULT 0;

-- 2. Opdater status-beregning til at inkludere turneringer
CREATE OR REPLACE FUNCTION public.recalc_americano_profile_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  w int;
  l int;
  d int;
  p int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Sejre (runder)
  SELECT COUNT(*)::int INTO w
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score <> m.team_b_score
    AND (
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_a_p1, m.team_a_p2)) AND m.team_a_score > m.team_b_score)
      OR
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_b_p1, m.team_b_p2)) AND m.team_b_score > m.team_a_score)
    );

  -- Tab (runder)
  SELECT COUNT(*)::int INTO l
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score <> m.team_b_score
    AND (
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_a_p1, m.team_a_p2)) AND m.team_b_score > m.team_a_score)
      OR
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_b_p1, m.team_b_p2)) AND m.team_a_score > m.team_b_score)
    );

  -- Uafgjort (runder)
  SELECT COUNT(*)::int INTO d
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score = m.team_b_score
    AND (
      EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_a_p1, m.team_a_p2))
      OR
      EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_b_p1, m.team_b_p2))
    );

  -- ANTAL TURNERINGER SPILLET (afsluttede)
  SELECT COUNT(DISTINCT tournament_id)::int INTO p
  FROM public.americano_participants ap
  JOIN public.americano_tournaments t ON t.id = ap.tournament_id
  WHERE ap.user_id = p_user_id AND t.status = 'completed';

  UPDATE public.profiles
  SET
    americano_wins = COALESCE(w, 0),
    americano_losses = COALESCE(l, 0),
    americano_draws = COALESCE(d, 0),
    americano_played = COALESCE(p, 0)
  WHERE id = p_user_id;
END;
$$;

-- 3. Opdater RLS policies for at tillade "Alle kampe" visning
-- Vi ønsker at ALLE authenticated brugere kan se afsluttede (completed) turneringer.

DROP POLICY IF EXISTS americano_tournaments_select ON public.americano_tournaments;
CREATE POLICY americano_tournaments_select ON public.americano_tournaments
  FOR SELECT TO authenticated USING (
    status IN ('registration', 'completed') -- Åbn op for completed!
    OR creator_id = (select auth.uid())
    OR public.americano_is_participant(id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_participants_select ON public.americano_participants;
CREATE POLICY americano_participants_select ON public.americano_participants
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    OR public.americano_internal_tournament_status(tournament_id) IN ('registration', 'completed')
    OR public.americano_internal_tournament_creator(tournament_id) = (select auth.uid())
    OR public.americano_is_participant(tournament_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_matches_select ON public.americano_matches;
CREATE POLICY americano_matches_select ON public.americano_matches
  FOR SELECT TO authenticated USING (
    public.americano_internal_tournament_status(tournament_id) = 'completed' -- Alle kan se match results for afsluttede
    OR public.americano_internal_tournament_creator(tournament_id) = (select auth.uid())
    OR public.americano_is_participant(tournament_id, (select auth.uid()))
  );

-- 4. Kør en fuld synkronisering for alle brugere
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.recalc_americano_profile_stats(r.id);
  END LOOP;
END;
$$;
