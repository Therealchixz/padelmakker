-- ============================================================
-- Liga / Sæson-system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leagues (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  season_type   TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (season_type IN ('weekly', 'monthly')),
  status        TEXT NOT NULL DEFAULT 'registration'
                  CHECK (status IN ('registration', 'active', 'completed')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  current_round INT  NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.league_participants (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id     UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  avatar        TEXT,
  elo_at_signup INT  NOT NULL DEFAULT 1000,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.league_matches (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  round_number INT  NOT NULL DEFAULT 1,
  player1_id  UUID NOT NULL REFERENCES public.league_participants(id) ON DELETE CASCADE,
  player2_id  UUID          REFERENCES public.league_participants(id) ON DELETE CASCADE,
  winner_id   UUID          REFERENCES public.league_participants(id),
  score_text  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reported')),
  reported_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_league_participants_league ON public.league_participants(league_id);
CREATE INDEX IF NOT EXISTS idx_league_participants_user   ON public.league_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_league      ON public.league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_round       ON public.league_matches(league_id, round_number);

ALTER TABLE public.leagues             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_matches      ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues             TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.league_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.league_matches      TO authenticated;

-- Leagues: alle kan læse
DROP POLICY IF EXISTS leagues_select ON public.leagues;
CREATE POLICY leagues_select ON public.leagues
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS leagues_admin_insert ON public.leagues;
CREATE POLICY leagues_admin_insert ON public.leagues
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS leagues_admin_update ON public.leagues;
CREATE POLICY leagues_admin_update ON public.leagues
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS leagues_admin_delete ON public.leagues;
CREATE POLICY leagues_admin_delete ON public.leagues
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- League participants: alle kan læse
DROP POLICY IF EXISTS league_participants_select ON public.league_participants;
CREATE POLICY league_participants_select ON public.league_participants
  FOR SELECT TO authenticated USING (true);

-- Spiller kan tilmelde sig selv
DROP POLICY IF EXISTS league_participants_insert ON public.league_participants;
CREATE POLICY league_participants_insert ON public.league_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Spiller kan melde sig selv af; admin kan fjerne alle
DROP POLICY IF EXISTS league_participants_delete ON public.league_participants;
CREATE POLICY league_participants_delete ON public.league_participants
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- League matches: alle kan læse
DROP POLICY IF EXISTS league_matches_select ON public.league_matches;
CREATE POLICY league_matches_select ON public.league_matches
  FOR SELECT TO authenticated USING (true);

-- Kun admin kan indsætte (paringsgeneration)
DROP POLICY IF EXISTS league_matches_insert ON public.league_matches;
CREATE POLICY league_matches_insert ON public.league_matches
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Spillere i kampen kan rapportere; admin kan alt
DROP POLICY IF EXISTS league_matches_update ON public.league_matches;
CREATE POLICY league_matches_update ON public.league_matches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.league_participants lp
      WHERE lp.id IN (league_matches.player1_id, league_matches.player2_id)
        AND lp.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
