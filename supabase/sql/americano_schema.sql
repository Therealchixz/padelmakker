-- =============================================================================
-- Americano-turneringer (individuel / roterende makkere)
-- Påvirker IKKE ELO / elo_history — kun egne tabeller (+ valgfrit americano_wins/losses på profiles via americano_profile_stats.sql).
-- Spillervalg: 5, 6 eller 7 (8 kun bagudkompatibilitet). Kør migration hvis DB har gammel CHECK.
-- Kør i Supabase SQL Editor. Juster RLS efter jeres sikkerhedsmodel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.americano_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  tournament_date date NOT NULL,
  time_slot text NOT NULL DEFAULT '18:00',
  court_id uuid REFERENCES public.courts (id) ON DELETE SET NULL,
  -- Nye turneringer: 5, 6 eller 7. Værdien 8 er kun til bagudkompatibilitet (ældre rækker før skift fra 8/12/16).
  player_slots integer NOT NULL CHECK (player_slots IN (5, 6, 7, 8)),
  points_per_match integer NOT NULL CHECK (points_per_match IN (16, 24, 32)),
  description text,
  status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'playing', 'completed')),
  -- 1 = én gennemgang af rundeplanen; 2 = gentag hele planen (længere turnering, flere møder som modstander/makker)
  opponent_passes integer NOT NULL DEFAULT 1 CHECK (opponent_passes IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_americano_tournaments_creator ON public.americano_tournaments (creator_id);
CREATE INDEX IF NOT EXISTS idx_americano_tournaments_date ON public.americano_tournaments (tournament_date);

CREATE TABLE IF NOT EXISTS public.americano_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.americano_tournaments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_americano_participants_tournament ON public.americano_participants (tournament_id);

CREATE TABLE IF NOT EXISTS public.americano_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.americano_tournaments (id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  court_index integer NOT NULL DEFAULT 0,
  team_a_p1 uuid NOT NULL REFERENCES public.americano_participants (id) ON DELETE CASCADE,
  team_a_p2 uuid NOT NULL REFERENCES public.americano_participants (id) ON DELETE CASCADE,
  team_b_p1 uuid NOT NULL REFERENCES public.americano_participants (id) ON DELETE CASCADE,
  team_b_p2 uuid NOT NULL REFERENCES public.americano_participants (id) ON DELETE CASCADE,
  team_a_score integer,
  team_b_score integer,
  results_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_americano_matches_tournament ON public.americano_matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_americano_matches_round ON public.americano_matches (tournament_id, round_number);

ALTER TABLE public.americano_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.americano_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.americano_matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.americano_tournaments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.americano_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.americano_matches TO authenticated;

-- Hjælpere til RLS uden rekursion mellem tournaments ↔ participants
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

-- Synlighed: åbne turneringer for alle loggede; playing/completed kun opretter + deltagere
DROP POLICY IF EXISTS americano_tournaments_select ON public.americano_tournaments;
CREATE POLICY americano_tournaments_select ON public.americano_tournaments
  FOR SELECT TO authenticated USING (
    status = 'registration'
    OR creator_id = (select auth.uid())
    OR public.americano_is_participant(id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_tournaments_insert ON public.americano_tournaments;
CREATE POLICY americano_tournaments_insert ON public.americano_tournaments
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS americano_tournaments_update ON public.americano_tournaments;
CREATE POLICY americano_tournaments_update ON public.americano_tournaments
  FOR UPDATE TO authenticated USING ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS americano_tournaments_delete ON public.americano_tournaments;
CREATE POLICY americano_tournaments_delete ON public.americano_tournaments
  FOR DELETE TO authenticated USING ((select auth.uid()) = creator_id);

-- Deltagere: åbne turneringer = alle rækker; ellers opretter + deltagere i samme turnering
DROP POLICY IF EXISTS americano_participants_select ON public.americano_participants;
CREATE POLICY americano_participants_select ON public.americano_participants
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid())
    OR public.americano_internal_tournament_status(tournament_id) = 'registration'
    OR public.americano_internal_tournament_creator(tournament_id) = (select auth.uid())
    OR public.americano_is_participant(tournament_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_participants_insert ON public.americano_participants;
CREATE POLICY americano_participants_insert ON public.americano_participants
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS americano_participants_delete ON public.americano_participants;
CREATE POLICY americano_participants_delete ON public.americano_participants
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Kampe: kun opretter og deltagere kan læse (ikke hele verden)
DROP POLICY IF EXISTS americano_matches_select ON public.americano_matches;
CREATE POLICY americano_matches_select ON public.americano_matches
  FOR SELECT TO authenticated USING (
    public.americano_internal_tournament_creator(tournament_id) = (select auth.uid())
    OR public.americano_is_participant(tournament_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS americano_matches_insert_creator ON public.americano_matches;
CREATE POLICY americano_matches_insert_creator ON public.americano_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = tournament_id AND t.creator_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS americano_matches_update_creator ON public.americano_matches;
CREATE POLICY americano_matches_update_creator ON public.americano_matches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = americano_matches.tournament_id AND t.creator_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = americano_matches.tournament_id AND t.creator_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS americano_matches_delete_creator ON public.americano_matches;
CREATE POLICY americano_matches_delete_creator ON public.americano_matches
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = americano_matches.tournament_id AND t.creator_id = (select auth.uid())
    )
  );
