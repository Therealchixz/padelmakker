-- =============================================================================
-- apply_elo_for_match: dynamisk K + sejrsmargin (spilforskel på tværs af sæt)
--
-- K: mindst én spiller med games_played < 15 → K=40, ellers K=24 (før denne kamp).
--
-- Margin: |hold1 partier − hold2 partier| summeret over sæt 1–3 (NULL = 0).
-- Multiplikator på ELO-ændring (vinder får mere, taber mister mere ved stort clear):
--   margin ≤ 4  → 1.00  (fx 6-4 6-4 → 12-8, diff 4)
--   margin ≤ 9  → 1.12
--   margin ≤ 14 → 1.24
--   margin > 14 → 1.35  (fx 6-0 6-0 → 12-0, diff 12 → stadig 1.24; 6-0 6-0 6-0 → diff 18 → 1.35)
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
  v_k INTEGER;
  v_min_games INTEGER;
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
  INTO v_min_games
  FROM match_players mp
  JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id;

  v_k := CASE WHEN v_min_games < 15 THEN 40 ELSE 24 END;

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
    v_base_change := v_k * (1.0 - v_t1_expected);
  ELSE
    v_base_change := v_k * (0.0 - v_t1_expected);
  END IF;

  -- Partier vundet pr. hold (alle tre sæt; NULL tæller som 0)
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
    'k_used', v_k,
    'min_games_before_match', v_min_games,
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
