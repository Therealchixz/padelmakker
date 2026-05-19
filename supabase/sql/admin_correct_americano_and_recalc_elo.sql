-- =============================================================================
-- Admin: ret Americano-turneringsresultater og genberegn Americano-ELO
-- Kør i Supabase → SQL Editor (kræver apply_americano_elo_for_tournament)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalc_americano_elo_from_history(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_base_rating numeric;
  v_total_delta numeric;
  v_played int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT h.old_rating::numeric
    INTO v_base_rating
  FROM public.americano_elo_history h
  WHERE h.user_id = p_user_id
  ORDER BY h.created_at ASC, h.tournament_id ASC, h.id ASC
  LIMIT 1;

  IF v_base_rating IS NULL THEN
    UPDATE public.profiles
    SET
      americano_elo_rating = 1000,
      americano_played = 0
    WHERE id = p_user_id;
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(h.change::numeric), 0),
    COUNT(*)::int
  INTO v_total_delta, v_played
  FROM public.americano_elo_history h
  WHERE h.user_id = p_user_id;

  UPDATE public.profiles
  SET
    americano_elo_rating = GREATEST(100, ROUND(v_base_rating + v_total_delta)::int),
    americano_played = COALESCE(v_played, 0)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_americano_elo_from_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_americano_elo_from_history(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalc_americano_elo_from_history(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_correct_americano_tournament(
  p_tournament_id uuid,
  p_matches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_points_per_match integer;
  v_status text;
  v_row jsonb;
  v_match_id uuid;
  v_a int;
  v_b int;
  v_user_id uuid;
  v_apply jsonb;
  v_expected int;
  v_updated int := 0;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun admin kan rette Americano-resultater');
  END IF;
  IF p_tournament_id IS NULL OR p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende eller ugyldige kampdata');
  END IF;

  SELECT t.status, t.points_per_match
    INTO v_status, v_points_per_match
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turnering ikke fundet');
  END IF;

  IF v_status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede turneringer kan rettes her');
  END IF;

  IF COALESCE(v_points_per_match, 0) NOT IN (16, 24, 32) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldigt pointformat på turneringen');
  END IF;

  SELECT COUNT(*)::int
    INTO v_expected
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id;

  IF v_expected = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turneringen har ingen kampe');
  END IF;

  IF jsonb_array_length(p_matches) <> v_expected THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      format('Alle %s kampe skal medsendes (%s modtaget)', v_expected, jsonb_array_length(p_matches))
    );
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    v_match_id := nullif(v_row->>'id', '')::uuid;
    IF v_match_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Hver kamp skal have et id');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.americano_matches m
      WHERE m.id = v_match_id AND m.tournament_id = p_tournament_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kamp tilhører ikke denne turnering');
    END IF;

    v_a := (v_row->>'team_a_score')::int;
    v_b := (v_row->>'team_b_score')::int;

    IF v_a IS NULL OR v_b IS NULL OR v_a < 0 OR v_b < 0 OR (v_a + v_b) <> v_points_per_match THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        format('Ugyldig score for kamp %s (summen skal være %s)', v_match_id, v_points_per_match)
      );
    END IF;
  END LOOP;

  DELETE FROM public.americano_elo_history
  WHERE tournament_id = p_tournament_id;

  FOR v_user_id IN
    SELECT DISTINCT ap.user_id
    FROM public.americano_participants ap
    WHERE ap.tournament_id = p_tournament_id
  LOOP
    PERFORM public.recalc_americano_elo_from_history(v_user_id);
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    v_match_id := (v_row->>'id')::uuid;
    v_a := (v_row->>'team_a_score')::int;
    v_b := (v_row->>'team_b_score')::int;

    UPDATE public.americano_matches
    SET
      team_a_score = v_a,
      team_b_score = v_b,
      results_locked = true,
      updated_at = now()
    WHERE id = v_match_id
      AND tournament_id = p_tournament_id;

    v_updated := v_updated + 1;
  END LOOP;

  FOR v_user_id IN
    SELECT DISTINCT ap.user_id
    FROM public.americano_participants ap
    WHERE ap.tournament_id = p_tournament_id
  LOOP
    PERFORM public.recalc_americano_profile_stats(v_user_id);
  END LOOP;

  v_apply := public.apply_americano_elo_for_tournament(p_tournament_id);

  IF COALESCE(v_apply->>'success', 'false')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_apply->>'error', 'Americano-ELO kunne ikke genberegnes')
      USING DETAIL = coalesce(v_apply::text, '');
  END IF;

  PERFORM public._admin_audit_log(
    'correct_americano_tournament',
    NULL,
    jsonb_build_object('tournament_id', p_tournament_id, 'matches_updated', v_updated)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tournament_id', p_tournament_id,
    'matches_updated', v_updated,
    'elo', v_apply
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_americano_tournament(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_correct_americano_tournament(uuid, jsonb) TO authenticated;
