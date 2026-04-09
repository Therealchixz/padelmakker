-- =============================================================================
-- apply_elo_for_match: dynamisk K + sejrsmargin (spilforskel på tværs af sæt)
--
-- K pr. HOLD (ikke alle fire spillere):
--   Per hold: min(games_played) på de to spillere FØR denne kamp.
--   Hvis min < 10 → K_hold = 40, ellers K_hold = 24.
-- Kampens effektive K = (K_hold1 + K_hold2) / 2 (kan blive 32 hvis 40+24).
-- Så kan modstanderens "nye" makker ikke længere sætte jeres K op alene.
--
-- Margin: |hold1 partier − hold2 partier| over sæt 1–3 (NULL = 0).
--   margin ≤ 4  → ×1.00   | ≤ 9 → ×1.12   | ≤ 14 → ×1.24   | > 14 → ×1.35
--
-- Kør hele filen i Supabase SQL Editor (erstatter public.apply_elo_for_match).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_elo_for_match(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mr match_results%ROWTYPE;
  v_match matches%ROWTYPE;
  v_t1_avg REAL;
  v_t2_avg REAL;
  v_t1_expected REAL;
  v_t1_won BOOLEAN;
  v_t1_change INTEGER;
  v_t2_change INTEGER;
  v_k1 INTEGER;
  v_k2 INTEGER;
  v_k_avg REAL;
  v_min_t1 INTEGER;
  v_min_t2 INTEGER;
  v_player RECORD;
  v_old_elo REAL;
  v_new_elo REAL;
  v_won BOOLEAN;
  v_updated_count INTEGER := 0;
  v_t1_games INTEGER;
  v_t2_games INTEGER;
  v_margin INTEGER;
  v_margin_mult REAL;
  v_base_change REAL;
BEGIN
  SELECT * INTO v_mr FROM match_results WHERE id = p_match_result_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match result not found');
  END IF;
  IF v_mr.confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Match result not confirmed yet');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = v_mr.match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'ELO already calculated for this match');
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

  v_t1_expected := 1.0 / (1.0 + power(10.0, (v_t2_avg - v_t1_avg) / 400.0));
  v_t1_won := (v_mr.match_winner = 'team1');

  IF v_t1_won THEN
    v_base_change := v_k_avg * (1.0 - v_t1_expected);
  ELSE
    v_base_change := v_k_avg * (0.0 - v_t1_expected);
  END IF;

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

  v_t1_change := round(v_base_change * v_margin_mult);
  IF v_t1_change = 0 AND v_base_change <> 0.0 THEN
    v_t1_change := CASE WHEN v_base_change > 0 THEN 1 ELSE -1 END;
  END IF;
  v_t2_change := -v_t1_change;

  FOR v_player IN
    SELECT mp.user_id, p.elo_rating, p.games_played, p.games_won
    FROM match_players mp
    JOIN profiles p ON p.id = mp.user_id
    WHERE mp.match_id = v_mr.match_id AND mp.team = 1
  LOOP
    v_old_elo := COALESCE(v_player.elo_rating, 1000);
    v_new_elo := GREATEST(100, v_old_elo + v_t1_change);
    v_won := v_t1_won;

    UPDATE profiles SET
      elo_rating = v_new_elo,
      games_played = COALESCE(games_played, 0) + 1,
      games_won = COALESCE(games_won, 0) + CASE WHEN v_won THEN 1 ELSE 0 END
    WHERE id = v_player.user_id;

    INSERT INTO elo_history (user_id, match_id, old_rating, new_rating, change, result)
    VALUES (v_player.user_id, v_mr.match_id, v_old_elo, v_new_elo, v_t1_change,
            CASE WHEN v_won THEN 'win' ELSE 'loss' END);

    v_updated_count := v_updated_count + 1;
  END LOOP;

  FOR v_player IN
    SELECT mp.user_id, p.elo_rating, p.games_played, p.games_won
    FROM match_players mp
    JOIN profiles p ON p.id = mp.user_id
    WHERE mp.match_id = v_mr.match_id AND mp.team = 2
  LOOP
    v_old_elo := COALESCE(v_player.elo_rating, 1000);
    v_new_elo := GREATEST(100, v_old_elo + v_t2_change);
    v_won := NOT v_t1_won;

    UPDATE profiles SET
      elo_rating = v_new_elo,
      games_played = COALESCE(games_played, 0) + 1,
      games_won = COALESCE(games_won, 0) + CASE WHEN v_won THEN 1 ELSE 0 END
    WHERE id = v_player.user_id;

    INSERT INTO elo_history (user_id, match_id, old_rating, new_rating, change, result)
    VALUES (v_player.user_id, v_mr.match_id, v_old_elo, v_new_elo, v_t2_change,
            CASE WHEN v_won THEN 'win' ELSE 'loss' END);

    v_updated_count := v_updated_count + 1;
  END LOOP;

  UPDATE matches SET status = 'completed' WHERE id = v_mr.match_id;

  RETURN jsonb_build_object(
    'success', true,
    'players_updated', v_updated_count,
    'k_used', round(v_k_avg)::int,
    'k_team1', v_k1,
    'k_team2', v_k2,
    'k_avg', v_k_avg,
    'min_games_team1', v_min_t1,
    'min_games_team2', v_min_t2,
    'team1_change', v_t1_change,
    'team2_change', v_t2_change,
    'winner', v_mr.match_winner,
    'games_margin', v_margin,
    'margin_multiplier', v_margin_mult,
    'games_team1', v_t1_games,
    'games_team2', v_t2_games
  );
END;
$function$;
