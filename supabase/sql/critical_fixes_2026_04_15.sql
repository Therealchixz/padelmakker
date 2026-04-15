-- ============================================================================
-- KRITISKE FIXES — 2026-04-15 Sikkerhedsrevision
-- Kør disse i rækkefølge i Supabase SQL Editor
-- ============================================================================


-- ============================================================================
-- PRE-FIX: Opdater protect_elo_fields triggeren
-- Tilføj bypass via session-variabel så SECURITY DEFINER RPCs kan opdatere
-- ELO-felter, mens direkte bruger-manipulation stadig blokeres.
-- Admins kan fortsat alt.
-- ============================================================================

CREATE OR REPLACE FUNCTION protect_elo_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Admins må alt
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Tillad interne RPCs (recalc, apply_elo osv.) at opdatere via session-variabel
  IF current_setting('app.bypass_elo_protection', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Ingen direkte ændring af ELO/statistik
  IF (NEW.elo_rating   IS DISTINCT FROM OLD.elo_rating)   OR
     (NEW.games_played IS DISTINCT FROM OLD.games_played) OR
     (NEW.games_won    IS DISTINCT FROM OLD.games_won)    THEN
    RAISE EXCEPTION 'Sikkerhedsfejl: Kun admins kan ændre ELO eller statistikker direkte.';
  END IF;

  -- Ingen brugere må ændre role, is_banned eller ban_reason på sig selv
  IF (NEW.role      IS DISTINCT FROM OLD.role)      OR
     (NEW.is_banned IS DISTINCT FROM OLD.is_banned) OR
     (NEW.ban_reason IS DISTINCT FROM OLD.ban_reason) THEN
    RAISE EXCEPTION 'Sikkerhedsfejl: Kun admins kan ændre rolle eller ban-status.';
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- FIX #1: recalc_profile_stats_from_elo_history — v_wins var aldrig tildelt
-- games_won blev sat til 0 ved hvert trigger-kald.
-- Sætter bypass-variabel så protect_elo_fields tillader opdateringen.
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

  -- Bypass protect_elo_fields triggeren (transaction-scoped, nulstilles automatisk)
  PERFORM set_config('app.bypass_elo_protection', 'true', true);

  -- Opdater profilen
  UPDATE public.profiles SET
    elo_rating   = GREATEST(100, ROUND(COALESCE(v_first, 1000) + COALESCE(v_delta, 0))::int),
    games_played = COALESCE(v_games, 0),
    games_won    = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END;
$$;


-- ============================================================================
-- Opdater apply_elo_for_match med samme bypass
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_elo_for_match(p_match_result_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mr match_results%ROWTYPE;
  v_match matches%ROWTYPE;
  v_t1_avg REAL;
  v_t2_avg REAL;
  v_t1_won BOOLEAN;
  v_k1 INTEGER;
  v_k2 INTEGER;
  v_k_avg REAL;
  v_min_t1 INTEGER;
  v_min_t2 INTEGER;
  v_player RECORD;
  v_rp REAL;
  v_opp_avg REAL;
  v_e REAL;
  v_raw REAL;
  v_delta INTEGER;
  v_old_elo REAL;
  v_new_elo REAL;
  v_won BOOLEAN;
  v_updated_count INTEGER := 0;
  v_t1_games INTEGER;
  v_t2_games INTEGER;
  v_margin INTEGER;
  v_margin_mult REAL;
  v_count_p INTEGER;
  v_t1_changes INTEGER[] := ARRAY[]::INTEGER[];
  v_t2_changes INTEGER[] := ARRAY[]::INTEGER[];
BEGIN
  SELECT * INTO v_mr FROM match_results WHERE id = p_match_result_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match result not found');
  END IF;
  IF v_mr.confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Match result not confirmed yet');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = v_mr.match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'ELO already calculated for this match');
  END IF;

  SELECT COUNT(*) INTO v_count_p FROM match_players WHERE match_id = v_mr.match_id;
  IF v_count_p < 4 THEN
    UPDATE matches SET status = 'completed', completed_at = now() WHERE id = v_mr.match_id;
    RETURN jsonb_build_object(
      'success', true,
      'players_updated', 0,
      'message', 'Kamp afsluttet uden ELO-ændringer (kræver 4 spillere)'
    );
  END IF;

  IF v_mr.match_winner <> 'team1' AND v_mr.match_winner <> 'team2' THEN
    RETURN jsonb_build_object('error', 'Match must have a distinct winner (team1 or team2) for ELO to apply');
  END IF;

  SELECT COALESCE(MIN(COALESCE(p.games_played, 0)), 0)
  INTO v_min_t1
  FROM match_players mp
  JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 1;

  SELECT COALESCE(MIN(COALESCE(p.games_played, 0)), 0)
  INTO v_min_t2
  FROM match_players mp
  JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 2;

  v_k1 := CASE WHEN v_min_t1 < 10 THEN 40 ELSE 24 END;
  v_k2 := CASE WHEN v_min_t2 < 10 THEN 40 ELSE 24 END;
  v_k_avg := (v_k1::REAL + v_k2::REAL) / 2.0;

  SELECT COALESCE(AVG(p.elo_rating), 1000) INTO v_t1_avg
  FROM match_players mp
  JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 1;

  SELECT COALESCE(AVG(p.elo_rating), 1000) INTO v_t2_avg
  FROM match_players mp
  JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 2;

  v_t1_won := (v_mr.match_winner = 'team1');

  v_t1_games :=
    COALESCE(v_mr.set1_team1, 0) + COALESCE(v_mr.set2_team1, 0) + COALESCE(v_mr.set3_team1, 0);
  v_t2_games :=
    COALESCE(v_mr.set1_team2, 0) + COALESCE(v_mr.set2_team2, 0) + COALESCE(v_mr.set3_team2, 0);
  v_margin := abs(v_t1_games - v_t2_games);

  v_margin_mult := CASE
    WHEN v_margin <= 4 THEN 1.0
    WHEN v_margin <= 9 THEN 1.12
    WHEN v_margin <= 14 THEN 1.24
    ELSE 1.35
  END;

  -- Bypass protect_elo_fields triggeren for denne transaktion
  PERFORM set_config('app.bypass_elo_protection', 'true', true);

  FOR v_player IN
    SELECT mp.user_id, mp.team, p.elo_rating, p.games_played, p.games_won
    FROM match_players mp
    JOIN profiles p ON p.id = mp.user_id
    WHERE mp.match_id = v_mr.match_id
    ORDER BY mp.team, mp.user_id
  LOOP
    v_rp := COALESCE(v_player.elo_rating, 1000)::REAL;
    IF v_player.team = 1 THEN
      v_opp_avg := v_t2_avg;
      v_won := v_t1_won;
    ELSE
      v_opp_avg := v_t1_avg;
      v_won := NOT v_t1_won;
    END IF;

    v_e := 1.0 / (1.0 + power(10.0, (v_opp_avg - v_rp) / 400.0));

    IF v_won THEN
      v_raw := v_k_avg * (1.0 - v_e);
    ELSE
      v_raw := v_k_avg * (0.0 - v_e);
    END IF;

    v_delta := round(v_raw * v_margin_mult);
    IF v_delta = 0 AND v_raw <> 0.0 THEN
      v_delta := CASE WHEN v_raw > 0 THEN 1 ELSE -1 END;
    END IF;

    v_old_elo := v_rp;
    v_new_elo := GREATEST(100, v_old_elo + v_delta::REAL);

    UPDATE profiles SET
      elo_rating = v_new_elo,
      games_played = COALESCE(games_played, 0) + 1,
      games_won = COALESCE(games_won, 0) + CASE WHEN v_won THEN 1 ELSE 0 END
    WHERE id = v_player.user_id;

    INSERT INTO elo_history (user_id, match_id, old_rating, new_rating, change, result)
    VALUES (v_player.user_id, v_mr.match_id, v_old_elo, v_new_elo, v_delta,
            CASE WHEN v_won THEN 'win' ELSE 'loss' END);

    v_updated_count := v_updated_count + 1;

    IF v_player.team = 1 THEN
      v_t1_changes := array_append(v_t1_changes, v_delta);
    ELSE
      v_t2_changes := array_append(v_t2_changes, v_delta);
    END IF;
  END LOOP;

  UPDATE matches SET status = 'completed', completed_at = now() WHERE id = v_mr.match_id;

  RETURN jsonb_build_object(
    'success', true,
    'model', 'individual_vs_opp_team_avg',
    'players_updated', v_updated_count,
    'k_used', round(v_k_avg)::int,
    'k_team1', v_k1,
    'k_team2', v_k2,
    'k_avg', v_k_avg,
    'min_games_team1', v_min_t1,
    'min_games_team2', v_min_t2,
    'team1_player_changes', to_jsonb(v_t1_changes),
    'team2_player_changes', to_jsonb(v_t2_changes),
    'winner', v_mr.match_winner,
    'games_margin', v_margin,
    'margin_multiplier', v_margin_mult,
    'games_team1', v_t1_games,
    'games_team2', v_t2_games,
    'opp_avg_for_team1_players', v_t2_avg,
    'opp_avg_for_team2_players', v_t1_avg
  );
END;
$$;


-- ============================================================================
-- Opdater admin_adjust_elo med samme bypass
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_elo int;
  v_diff int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin') THEN
    RAISE EXCEPTION 'Kun admins kan dette.';
  END IF;

  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  v_diff := p_new_elo - COALESCE(v_current_elo, 1000);

  IF v_diff <> 0 THEN
    INSERT INTO public.elo_history (user_id, old_rating, new_rating, change, result, date, created_at, match_id)
    VALUES (p_user_id, COALESCE(v_current_elo, 1000), p_new_elo, v_diff, 'adjustment', now(), now(), null);
  END IF;

  -- Bypass sættes automatisk i recalc via triggeren, men sæt den også her for sikkerhed
  PERFORM set_config('app.bypass_elo_protection', 'true', true);
  PERFORM public.recalc_profile_stats_from_elo_history(p_user_id);
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  RETURN v_current_elo;
END;
$$;


-- ============================================================================
-- Genberegn games_won for alle eksisterende spillere (reparér korrupt data)
-- Kører EFTER alle funktioner er opdateret med bypass.
-- ============================================================================

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

DROP TRIGGER IF EXISTS trg_enforce_max_players ON match_players;

CREATE TRIGGER trg_enforce_max_players
  BEFORE INSERT ON match_players
  FOR EACH ROW EXECUTE FUNCTION enforce_max_players();


-- ============================================================================
-- FIX #2: RPC til atomisk match-join
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

  SELECT status, max_players INTO v_status, v_max
  FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('error', 'Kampen er ikke åben for tilmelding');
  END IF;

  IF EXISTS (SELECT 1 FROM match_players WHERE match_id = p_match_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('error', 'Du er allerede tilmeldt');
  END IF;

  SELECT COUNT(*) INTO v_count FROM match_players WHERE match_id = p_match_id;
  IF v_count >= COALESCE(v_max, 4) THEN
    RETURN jsonb_build_object('error', 'Kampen er fuld');
  END IF;

  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, v_uid, p_user_name, p_user_email, p_user_emoji, p_team);

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


-- ============================================================================
-- FIX #4: RPC til atomisk match-leave
-- ============================================================================

CREATE OR REPLACE FUNCTION leave_match(p_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid;
  v_status text;
  v_creator uuid;
  v_remaining int;
  v_next_creator uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;

  SELECT status, creator_id INTO v_status, v_creator
  FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_status IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('error', 'Du kan ikke afmelde dig en kamp, der er i gang eller afsluttet.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM match_players WHERE match_id = p_match_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('error', 'Du er ikke tilmeldt denne kamp.');
  END IF;

  DELETE FROM match_players WHERE match_id = p_match_id AND user_id = v_uid;

  SELECT COUNT(*) INTO v_remaining FROM match_players WHERE match_id = p_match_id;

  IF v_remaining = 0 THEN
    UPDATE matches SET status = 'cancelled', current_players = 0 WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'message', 'Kampen er slettet (ingen spillere tilbage).');
  END IF;

  IF v_creator = v_uid THEN
    SELECT user_id INTO v_next_creator FROM match_players WHERE match_id = p_match_id ORDER BY joined_at ASC LIMIT 1;
    UPDATE matches SET creator_id = v_next_creator, status = 'open', current_players = v_remaining WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'message', 'Du er afmeldt. Kampen er givet videre.');
  END IF;

  UPDATE matches SET status = 'open', current_players = v_remaining WHERE id = p_match_id;
  RETURN jsonb_build_object('success', true, 'message', 'Du er afmeldt.');
END;
$$;


-- ============================================================================
-- FIX #5: RPC til atomisk kick-player
-- ============================================================================

CREATE OR REPLACE FUNCTION kick_player_from_match(p_match_id uuid, p_target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid;
  v_creator uuid;
  v_remaining int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;

  SELECT creator_id INTO v_creator FROM matches WHERE id = p_match_id;
  IF v_creator IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Kun opretteren eller admin kan fjerne spillere.');
  END IF;

  DELETE FROM match_players WHERE match_id = p_match_id AND user_id = p_target_user_id;

  SELECT COUNT(*) INTO v_remaining FROM match_players WHERE match_id = p_match_id;
  UPDATE matches SET status = 'open', current_players = v_remaining WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'remaining', v_remaining);
END;
$$;


-- ============================================================================
-- FIX #6: match_results UPDATE policy mangler admin-adgang
-- Admin kan ikke bekræfte kampresultater fordi UPDATE-policyen kun tillader
-- deltagere. Tilføj OR is_admin() til begge klausuler.
-- ============================================================================

-- Først: find og fjern den eksisterende UPDATE policy
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'match_results' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON match_results', pol.policyname);
  END LOOP;
END;
$$;

-- Opret ny UPDATE policy med admin-adgang
CREATE POLICY match_results_update_by_participant_or_admin ON match_results
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT mp.user_id FROM match_players mp WHERE mp.match_id = match_results.match_id)
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() IN (SELECT mp.user_id FROM match_players mp WHERE mp.match_id = match_results.match_id)
    OR public.is_admin()
  );


-- ============================================================================
-- FIX #7: Opdater admin_adjust_elo til at inkludere old_rating og new_rating
-- Så frontend kan vise justeringer korrekt i ELO-graf og beregninger.
-- (Allerede inkluderet i funktionsdefinitionen ovenfor)
-- ============================================================================

-- Reparer eksisterende adjustment-rækker der mangler old_rating/new_rating.
-- Bruger profil-ELO minus ændring som tilnærmelse til old_rating.
DO $$
DECLARE
  r RECORD;
  v_profile_elo numeric;
BEGIN
  FOR r IN
    SELECT id, user_id, change FROM public.elo_history
    WHERE result = 'adjustment' AND old_rating IS NULL AND change IS NOT NULL
  LOOP
    SELECT COALESCE(elo_rating, 1000) INTO v_profile_elo
    FROM public.profiles WHERE id = r.user_id;

    UPDATE public.elo_history SET
      old_rating = v_profile_elo - r.change,
      new_rating = v_profile_elo
    WHERE id = r.id;
  END LOOP;
END;
$$;


-- ============================================================================
-- FIX #8: Admin kan ikke slette kampe — DELETE policies mangler is_admin()
-- matches, match_results og notifications DELETE policies opdateres.
-- ============================================================================

-- matches: kun creator kunne slette — tilføj admin
DROP POLICY IF EXISTS "Opretteren kan slette sin kamp" ON matches;
DROP POLICY IF EXISTS matches_delete_by_creator_or_admin ON matches;

CREATE POLICY matches_delete_by_creator_or_admin ON matches
  FOR DELETE TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.is_admin()
  );

-- match_results: kun submitter kunne slette — tilføj admin
DROP POLICY IF EXISTS "Indsenderen kan slette afviste resultater" ON match_results;
DROP POLICY IF EXISTS match_results_delete_by_submitter_or_admin ON match_results;

CREATE POLICY match_results_delete_by_submitter_or_admin ON match_results
  FOR DELETE TO authenticated
  USING (
    auth.uid() = submitted_by
    OR public.is_admin()
  );

-- notifications: kun ejer kunne slette — tilføj admin
DROP POLICY IF EXISTS notifications_delete_own ON notifications;
DROP POLICY IF EXISTS notifications_delete_own_or_admin ON notifications;

CREATE POLICY notifications_delete_own_or_admin ON notifications
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_admin()
  );
