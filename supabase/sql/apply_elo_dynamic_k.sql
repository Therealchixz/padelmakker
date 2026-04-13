-- =============================================================================
-- apply_elo_for_match: individuel ELO mod modstanderholdets snit + K pr. hold + margin
--
-- Hver spiller: forventet score E = 1 / (1 + 10^((R_mod_snit - R_spiller) / 400))
--   hvor R_mod_snit = gennemsnit af de to modstanderes rating før kampen.
-- Delta = round(K_kamp * (S - E) * margin_mult), S = 1 ved sejr, 0 ved tab.
--
-- K pr. hold: min(games_played) på holdet før kamp; < 10 → 40, ellers 24.
-- K_kamp = (K_hold1 + K_hold2) / 2.
--
-- Margin (partier over sæt 1–3): ≤4 →×1 | ≤9 →×1.12 | ≤14 →×1.24 | else ×1.35
--
-- Kør hele filen i Supabase SQL Editor (erstatter public.apply_elo_for_match).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_elo_for_match(p_match_result_id uuid)
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

  -- Låser rækken under denne transaktion, så vi ikke kan ramme en race-condition
  -- hvis to spillere bekræfter resultatet på præcis samme tid.
  SELECT * INTO v_match FROM matches WHERE id = v_mr.match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'ELO already calculated for this match');
  END IF;

  -- Hvis kampen af en eller anden syg grund er endt uafgjort (draw)
  -- Tillader vi ikke normal ELO distribution, da der ikke er en vinder.
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

  UPDATE matches SET status = 'completed' WHERE id = v_mr.match_id;

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
$function$;
