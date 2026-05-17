-- =============================================================================
-- Admin: ret 2v2-kampresultat og genberegn ELO
-- Kør i Supabase → SQL Editor (kræver apply_elo_for_match_core / elo_v2)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_correct_match_result_and_recalc_elo(
  p_match_result_id uuid,
  p_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_mr public.match_results%ROWTYPE;
  v_match_id uuid;
  v_player_id uuid;
  v_winner text;
  v_score_display text;
  v_elo jsonb;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun admin kan rette kampresultater');
  END IF;
  IF p_match_result_id IS NULL OR p_result IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende data');
  END IF;

  v_winner := nullif(trim(p_result->>'match_winner'), '');
  IF v_winner NOT IN ('team1', 'team2') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig vinder (team1 eller team2)');
  END IF;

  v_score_display := nullif(trim(p_result->>'score_display'), '');
  IF v_score_display IS NULL OR length(v_score_display) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende score_display');
  END IF;

  SELECT * INTO v_mr
  FROM public.match_results
  WHERE id = p_match_result_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Resultat ikke fundet');
  END IF;

  IF v_mr.confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun bekræftede resultater kan rettes her');
  END IF;

  v_match_id := v_mr.match_id;

  -- Fjern tidligere ELO for kampen
  DELETE FROM public.elo_history WHERE match_id = v_match_id;

  IF to_regclass('public.glicko2_shadow_history') IS NOT NULL THEN
    DELETE FROM public.glicko2_shadow_history WHERE match_id = v_match_id;
  END IF;

  FOR v_player_id IN
    SELECT mp.user_id
    FROM public.match_players mp
    WHERE mp.match_id = v_match_id
  LOOP
    PERFORM public.recalc_profile_stats_from_elo_history(v_player_id);
  END LOOP;

  UPDATE public.matches
  SET status = 'in_progress', completed_at = NULL
  WHERE id = v_match_id;

  UPDATE public.match_results
  SET
    set1_team1 = nullif(p_result->>'set1_team1', '')::int,
    set1_team2 = nullif(p_result->>'set1_team2', '')::int,
    set1_tb1 = nullif(p_result->>'set1_tb1', '')::int,
    set1_tb2 = nullif(p_result->>'set1_tb2', '')::int,
    set2_team1 = nullif(p_result->>'set2_team1', '')::int,
    set2_team2 = nullif(p_result->>'set2_team2', '')::int,
    set2_tb1 = nullif(p_result->>'set2_tb1', '')::int,
    set2_tb2 = nullif(p_result->>'set2_tb2', '')::int,
    set3_team1 = nullif(p_result->>'set3_team1', '')::int,
    set3_team2 = nullif(p_result->>'set3_team2', '')::int,
    set3_tb1 = nullif(p_result->>'set3_tb1', '')::int,
    set3_tb2 = nullif(p_result->>'set3_tb2', '')::int,
    sets_won_team1 = nullif(p_result->>'sets_won_team1', '')::int,
    sets_won_team2 = nullif(p_result->>'sets_won_team2', '')::int,
    match_winner = v_winner,
    score_display = v_score_display,
    confirmed = true
  WHERE id = p_match_result_id;

  v_elo := public.apply_elo_for_match_core(p_match_result_id, v_admin, true);

  IF COALESCE(v_elo->>'success', 'false')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_elo->>'error', 'ELO kunne ikke genberegnes')
      USING DETAIL = coalesce(v_elo::text, '');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', v_match_id,
    'score_display', v_score_display,
    'elo', v_elo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_match_result_and_recalc_elo(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_correct_match_result_and_recalc_elo(uuid, jsonb) TO authenticated;
