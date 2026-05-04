-- =============================================================================
-- Auto-confirm match results that have been pending for more than 24 hours.
--
-- Flow per result:
--   1. Find an opponent player (different team from submitted_by).
--   2. Set confirmed = true, confirmed_by = <opponent player>.
--   3. Apply ELO via the system-internal variant (no auth context needed).
--
-- Schedule: run every 30 minutes via pg_cron.
--
-- Requires pg_cron extension: run once as superuser:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal ELO function — identical to apply_elo_for_match but without the
-- auth.uid() / v_can_apply guards. Not callable by any role (no GRANT).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_elo_for_match_system(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
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
  v_distinct_players INTEGER;
  v_t1_count INTEGER;
  v_t2_count INTEGER;
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

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT user_id)::int,
    COUNT(*) FILTER (WHERE team = 1)::int,
    COUNT(*) FILTER (WHERE team = 2)::int
  INTO v_count_p, v_distinct_players, v_t1_count, v_t2_count
  FROM match_players
  WHERE match_id = v_mr.match_id;

  IF v_count_p <> 4 OR v_distinct_players <> 4 OR v_t1_count <> 2 OR v_t2_count <> 2 THEN
    RETURN jsonb_build_object(
      'error',
      'ELO requires exactly 2 unique players on each team'
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

  PERFORM set_config('app.bypass_profile_protection', 'on', true);

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
    'model', 'individual_vs_opp_team_avg_system',
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
$function$;

REVOKE ALL ON FUNCTION public.apply_elo_for_match_system(uuid) FROM PUBLIC;
-- No GRANT: only callable from auto_confirm_expired_match_results (SECURITY DEFINER context).

-- -----------------------------------------------------------------------------
-- auto_confirm_expired_match_results
-- Finds unconfirmed results older than 24 hours and auto-confirms them.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_expired_match_results()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_result match_results%ROWTYPE;
  v_submitter_team integer;
  v_opponent_id uuid;
  v_confirmed_count integer := 0;
  v_elo_applied_count integer := 0;
  v_skipped_count integer := 0;
  v_elo_result jsonb;
BEGIN
  FOR v_result IN
    SELECT *
    FROM match_results
    WHERE confirmed = false
      AND created_at < now() - interval '24 hours'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Find the submitter's team
    SELECT mp.team INTO v_submitter_team
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id = v_result.submitted_by
    LIMIT 1;

    -- Find an opponent player (different team, not the submitter themselves)
    SELECT mp.user_id INTO v_opponent_id
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id <> v_result.submitted_by
      AND (v_submitter_team IS NULL OR mp.team <> v_submitter_team)
    LIMIT 1;

    IF v_opponent_id IS NULL THEN
      -- Cannot find a valid confirmer; skip (corrupt match data)
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Auto-confirm the result with the opponent as confirmer
    UPDATE match_results
    SET confirmed = true,
        confirmed_by = v_opponent_id
    WHERE id = v_result.id;

    v_confirmed_count := v_confirmed_count + 1;

    -- Apply ELO without an auth context
    v_elo_result := public.apply_elo_for_match_system(v_result.id);
    IF (v_elo_result->>'success')::boolean IS TRUE THEN
      v_elo_applied_count := v_elo_applied_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'confirmed', v_confirmed_count,
    'elo_applied', v_elo_applied_count,
    'skipped', v_skipped_count,
    'ran_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_confirm_expired_match_results() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_confirm_expired_match_results() TO service_role;

-- -----------------------------------------------------------------------------
-- pg_cron schedule — runs every 30 minutes.
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_cron; (run as superuser once)
-- In Supabase: enable via Dashboard → Database → Extensions → pg_cron
-- -----------------------------------------------------------------------------
SELECT cron.unschedule('auto-confirm-expired-results')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-expired-results'
  );

SELECT cron.schedule(
  'auto-confirm-expired-results',
  '*/30 * * * *',
  'SELECT public.auto_confirm_expired_match_results()'
);
