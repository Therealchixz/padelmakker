-- Pulje-model: "Jeg vil spille" → automatisk kamp når fire passer sammen.
--
-- Baggrund: kun 4 personer har nogensinde oprettet en kamp, og 8 af 13 kampe
-- døde med opretteren alene. Byrden ved at organisere ligger hos brugeren.
--
-- Her vender vi det om. En bruger melder en lav-forpligtelses hensigt ("jeg kan
-- tirsdag 17-21"), og systemet samler fire overlappende hensigter til et
-- forslag. Bekræfter alle fire, oprettes kampen automatisk med hold fordelt.
--
-- Hensigter er bevidst dato-konkrete: en vag "søger makker"-tilstand kan ikke
-- omsættes til en kamp, men "tirsdag 17-21" kan.

CREATE TABLE IF NOT EXISTS public.play_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  play_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  region text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  level numeric,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'proposed', 'matched', 'cancelled', 'expired')),
  proposal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT play_intents_window_valid CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS play_intents_user_slot_uniq
  ON public.play_intents (user_id, play_date, start_time, end_time)
  WHERE status IN ('open', 'proposed');

CREATE INDEX IF NOT EXISTS play_intents_open_lookup
  ON public.play_intents (play_date, status);

CREATE TABLE IF NOT EXISTS public.match_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  region text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'expired')),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_proposals_pending
  ON public.match_proposals (status, expires_at);

CREATE TABLE IF NOT EXISTS public.match_proposal_members (
  proposal_id uuid NOT NULL REFERENCES public.match_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intent_id uuid REFERENCES public.play_intents(id) ON DELETE SET NULL,
  response text NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  PRIMARY KEY (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS match_proposal_members_user
  ON public.match_proposal_members (user_id);

ALTER TABLE public.play_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_proposal_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS play_intents_select_own ON public.play_intents;
CREATE POLICY play_intents_select_own ON public.play_intents
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS match_proposals_select_member ON public.match_proposals;
CREATE POLICY match_proposals_select_member ON public.match_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_proposal_members m
    WHERE m.proposal_id = match_proposals.id
      AND m.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS match_proposal_members_select_member ON public.match_proposal_members;
CREATE POLICY match_proposal_members_select_member ON public.match_proposal_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_proposal_members mine
    WHERE mine.proposal_id = match_proposal_members.proposal_id
      AND mine.user_id = (SELECT auth.uid())
  ));

-- Skrivning sker udelukkende gennem RPC'erne nedenfor.
REVOKE INSERT, UPDATE, DELETE ON public.play_intents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_proposals FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_proposal_members FROM authenticated;
GRANT SELECT ON public.play_intents TO authenticated;
GRANT SELECT ON public.match_proposals TO authenticated;
GRANT SELECT ON public.match_proposal_members TO authenticated;
