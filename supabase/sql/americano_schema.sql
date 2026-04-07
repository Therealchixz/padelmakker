-- =============================================================================
-- Americano-turneringer (individuel / roterende makkere)
-- Påvirker IKKE ELO / elo_history — kun egne tabeller (+ valgfrit americano_wins/losses på profiles via americano_profile_stats.sql).
-- Kør i Supabase SQL Editor. Juster RLS efter jeres sikkerhedsmodel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.americano_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  tournament_date date NOT NULL,
  time_slot text NOT NULL DEFAULT '18:00',
  court_id uuid REFERENCES public.courts (id) ON DELETE SET NULL,
  player_slots integer NOT NULL CHECK (player_slots IN (8, 12, 16)),
  points_per_match integer NOT NULL CHECK (points_per_match IN (16, 24, 32)),
  description text,
  status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'playing', 'completed')),
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

-- Alle loggede må se turneringer
DROP POLICY IF EXISTS americano_tournaments_select ON public.americano_tournaments;
CREATE POLICY americano_tournaments_select ON public.americano_tournaments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS americano_tournaments_insert ON public.americano_tournaments;
CREATE POLICY americano_tournaments_insert ON public.americano_tournaments
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS americano_tournaments_update ON public.americano_tournaments;
CREATE POLICY americano_tournaments_update ON public.americano_tournaments
  FOR UPDATE TO authenticated USING ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS americano_tournaments_delete ON public.americano_tournaments;
CREATE POLICY americano_tournaments_delete ON public.americano_tournaments
  FOR DELETE TO authenticated USING ((select auth.uid()) = creator_id);

-- Deltagere: alle kan læse; bruger kan melde sig til / afmelde sig selv
DROP POLICY IF EXISTS americano_participants_select ON public.americano_participants;
CREATE POLICY americano_participants_select ON public.americano_participants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS americano_participants_insert ON public.americano_participants;
CREATE POLICY americano_participants_insert ON public.americano_participants
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS americano_participants_delete ON public.americano_participants;
CREATE POLICY americano_participants_delete ON public.americano_participants
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Kampe: alle kan læse; kun opretter opdaterer (resultater) — enkelt i v1
DROP POLICY IF EXISTS americano_matches_select ON public.americano_matches;
CREATE POLICY americano_matches_select ON public.americano_matches
  FOR SELECT TO authenticated USING (true);

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
