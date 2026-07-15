-- Harden lifecycle for 2v2 / Americano / Liga:
-- 1) Ét resultat pr. 2v2-kamp
-- 2) Americano leave/kick kun i registration (undgå CASCADE wipe af kampe)
-- 3) Liga hold-slet kun i registration (undgå CASCADE wipe af kampe)
-- 4) Americano join: kun registration + capacity
-- 5) Unikt Mexicano-runde/bane (race-safe advance)

-- ─── 1) Unikt 2v2-resultat ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_results_match_id
  ON public.match_results (match_id);

-- ─── 2) Americano participants DELETE ────────────────────────────────────────
DROP POLICY IF EXISTS americano_participants_delete ON public.americano_participants;
DROP POLICY IF EXISTS americano_participants_creator_delete ON public.americano_participants;
DROP POLICY IF EXISTS "americano_participants_creator_delete" ON public.americano_participants;
DROP POLICY IF EXISTS "americano_participants_admin_delete" ON public.americano_participants;
DROP POLICY IF EXISTS americano_participants_admin_delete ON public.americano_participants;

CREATE POLICY americano_participants_delete
  ON public.americano_participants
  FOR DELETE TO authenticated
  USING (
    -- Kun under registration: DELETE CASCADE kan ellers slette kampe midt i turnering.
    EXISTS (
      SELECT 1
      FROM public.americano_tournaments t
      WHERE t.id = americano_participants.tournament_id
        AND t.status = 'registration'
    )
    AND (
      user_id = (SELECT auth.uid())
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.americano_tournaments t
        WHERE t.id = americano_participants.tournament_id
          AND t.creator_id = (SELECT auth.uid())
      )
    )
  );

-- ─── 3) Liga team DELETE ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS league_teams_delete ON public.league_teams;

CREATE POLICY league_teams_delete
  ON public.league_teams
  FOR DELETE TO authenticated
  USING (
    -- Kun under registration: DELETE CASCADE kan ellers slette liga-kampe.
    EXISTS (
      SELECT 1
      FROM public.leagues l
      WHERE l.id = league_teams.league_id
        AND lower(coalesce(l.status, '')) = 'registration'
    )
    AND (
      player1_id = (SELECT auth.uid())
      OR player2_id = (SELECT auth.uid())
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.leagues l
        WHERE l.id = league_teams.league_id
          AND l.created_by = (SELECT auth.uid())
      )
    )
  );

-- ─── 4) Americano join guard (status + capacity) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_americano_participant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_slots integer;
  v_count integer;
BEGIN
  SELECT t.status, t.player_slots
    INTO v_status, v_slots
  FROM public.americano_tournaments t
  WHERE t.id = NEW.tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF lower(coalesce(v_status, '')) <> 'registration' THEN
    RAISE EXCEPTION 'tournament_not_open';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.americano_participants
  WHERE tournament_id = NEW.tournament_id;

  IF v_slots IS NOT NULL AND v_count >= v_slots THEN
    RAISE EXCEPTION 'tournament_full';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_americano_participant_insert ON public.americano_participants;
CREATE TRIGGER trg_guard_americano_participant_insert
  BEFORE INSERT ON public.americano_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_americano_participant_insert();

-- ─── 5) Mexicano/Americano unik runde+bane ───────────────────────────────────
-- Fjern duplikater før unik index (behold ældste række).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tournament_id, round_number, coalesce(court_index, 0)
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.americano_matches
)
DELETE FROM public.americano_matches m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_americano_matches_round_court
  ON public.americano_matches (tournament_id, round_number, (coalesce(court_index, 0)));
