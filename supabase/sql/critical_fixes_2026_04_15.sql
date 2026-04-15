-- ============================================================================
-- KRITISKE FIXES — 2026-04-15 Sikkerhedsrevision
-- Kør disse i rækkefølge i Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- FIX #1: recalc_profile_stats_from_elo_history — v_wins var aldrig tildelt
-- games_won blev sat til 0 ved hvert trigger-kald.
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_first numeric;
  v_delta numeric;
  v_games int;
  v_wins  int;
BEGIN
  -- Tæl rigtige kampe
  SELECT COUNT(*)::int INTO v_games FROM public.elo_history
  WHERE user_id = p_user_id AND match_id IS NOT NULL;

  -- FIX: Tæl faktiske sejre fra elo_history (var aldrig tildelt før!)
  SELECT COUNT(*)::int INTO v_wins FROM public.elo_history
  WHERE user_id = p_user_id AND match_id IS NOT NULL AND result = 'win';

  -- Find fundamentet (første rating)
  SELECT e.old_rating::numeric INTO v_first FROM public.elo_history e
  WHERE e.user_id = p_user_id AND e.old_rating IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST LIMIT 1;

  -- Beregn samlet ændring
  SELECT COALESCE(SUM(CASE
    WHEN change IS NOT NULL THEN change::numeric
    WHEN new_rating IS NOT NULL AND old_rating IS NOT NULL THEN (new_rating - old_rating)::numeric
    ELSE 0 END), 0) INTO v_delta
  FROM public.elo_history WHERE user_id = p_user_id;

  -- Opdater profilen
  UPDATE public.profiles SET
    elo_rating   = GREATEST(100, ROUND(COALESCE(v_first, 1000) + COALESCE(v_delta, 0))::int),
    games_played = COALESCE(v_games, 0),
    games_won    = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END;
$$;

-- Genberegn games_won for alle eksisterende spillere (reparér korrupt data)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.elo_history WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.recalc_profile_stats_from_elo_history(r.user_id);
  END LOOP;
END;
$$;


-- ============================================================================
-- FIX #3: Trigger der håndhæver max_players ved match-join
-- Forhindrer race conditions hvor to spillere joiner samtidigt.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_max_players()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_current int;
  v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM match_players WHERE match_id = NEW.match_id;
  SELECT max_players INTO v_max FROM matches WHERE id = NEW.match_id;

  IF v_current >= COALESCE(v_max, 4) THEN
    RAISE EXCEPTION 'Kampen er fuld (% / % spillere)', v_current, v_max;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop hvis den allerede eksisterer
DROP TRIGGER IF EXISTS trg_enforce_max_players ON match_players;

CREATE TRIGGER trg_enforce_max_players
  BEFORE INSERT ON match_players
  FOR EACH ROW EXECUTE FUNCTION enforce_max_players();


-- ============================================================================
-- FIX #2: RPC til atomisk match-join (erstatter client-side status-opdatering)
-- Frontend bør kalde denne i stedet for manuelt INSERT + UPDATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION join_match(
  p_match_id uuid,
  p_team int,
  p_user_name text DEFAULT NULL,
  p_user_email text DEFAULT NULL,
  p_user_emoji text DEFAULT '🎾'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid;
  v_count int;
  v_t1 int;
  v_t2 int;
  v_max int;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;

  -- Lås match-rækken for at forhindre race condition
  SELECT status, max_players INTO v_status, v_max
  FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('error', 'Kampen er ikke åben for tilmelding');
  END IF;

  -- Tjek om allerede tilmeldt (unique constraint fanger det også)
  IF EXISTS (SELECT 1 FROM match_players WHERE match_id = p_match_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('error', 'Du er allerede tilmeldt');
  END IF;

  -- Tjek kapacitet
  SELECT COUNT(*) INTO v_count FROM match_players WHERE match_id = p_match_id;
  IF v_count >= COALESCE(v_max, 4) THEN
    RETURN jsonb_build_object('error', 'Kampen er fuld');
  END IF;

  -- Indsæt spilleren
  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, v_uid, p_user_name, p_user_email, p_user_emoji, p_team);

  -- Genoptæl og opdatér status atomisk
  SELECT COUNT(*) INTO v_count FROM match_players WHERE match_id = p_match_id;
  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;

  UPDATE matches SET
    current_players = v_count,
    status = CASE WHEN v_t1 >= 2 AND v_t2 >= 2 THEN 'full' ELSE 'open' END
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'current_players', v_count,
    'status', CASE WHEN v_t1 >= 2 AND v_t2 >= 2 THEN 'full' ELSE 'open' END
  );
END;
$$;
