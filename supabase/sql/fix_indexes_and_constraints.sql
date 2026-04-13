-- =============================================================================
-- Manglende indexes og CHECK-constraints (oprettet som fix efter review)
-- Kør i Supabase → SQL Editor. Alle statements er idempotente (IF NOT EXISTS / IF EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Index på americano_participants(user_id)
--    Bruges i alle RLS-policies, recalc-funktioner og trigger-loop.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_americano_participants_user_id
  ON public.americano_participants (user_id);

-- -----------------------------------------------------------------------------
-- 2) Indexes på americano_matches team-kolonner
--    recalc_americano_profile_stats søger på alle fire via IN (p1, p2).
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_a_p1
  ON public.americano_matches (team_a_p1);

CREATE INDEX IF NOT EXISTS idx_americano_matches_team_a_p2
  ON public.americano_matches (team_a_p2);

CREATE INDEX IF NOT EXISTS idx_americano_matches_team_b_p1
  ON public.americano_matches (team_b_p1);

CREATE INDEX IF NOT EXISTS idx_americano_matches_team_b_p2
  ON public.americano_matches (team_b_p2);

-- -----------------------------------------------------------------------------
-- 3) CHECK-constraint: alle fire spillere i en kamp skal være unikke
--    Forhindrer at samme deltager kan stå på begge hold via direkte API-kald.
-- -----------------------------------------------------------------------------
ALTER TABLE public.americano_matches
  DROP CONSTRAINT IF EXISTS americano_matches_players_distinct;

ALTER TABLE public.americano_matches
  ADD CONSTRAINT americano_matches_players_distinct CHECK (
    team_a_p1 <> team_a_p2 AND
    team_a_p1 <> team_b_p1 AND
    team_a_p1 <> team_b_p2 AND
    team_a_p2 <> team_b_p1 AND
    team_a_p2 <> team_b_p2 AND
    team_b_p1 <> team_b_p2
  );
