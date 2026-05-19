-- =============================================================================
-- Admin: ret enkelt liga-kampresultat (ingen ELO — stilling genberegnes i app)
-- Kør i Supabase → SQL Editor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_correct_league_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_score_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_m public.league_matches%ROWTYPE;
  v_score text;
  v_hi int;
  v_lo int;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun admin kan rette liga-resultater');
  END IF;
  IF p_match_id IS NULL OR p_winner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende kamp eller vinder');
  END IF;

  SELECT * INTO v_m
  FROM public.league_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kamp ikke fundet');
  END IF;

  IF v_m.status <> 'reported' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun rapporterede kampe kan rettes her');
  END IF;

  IF p_winner_id NOT IN (v_m.team1_id, v_m.team2_id) AND NOT (v_m.team2_id IS NULL AND p_winner_id = v_m.team1_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vinder skal være et af holdene i kampen');
  END IF;

  v_score := nullif(trim(p_score_text), '');
  IF v_score IS NOT NULL THEN
    IF v_score !~ '^\d+-\d+$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Score skal skrives som X-Y, f.eks. 6-4');
    END IF;
    v_hi := GREATEST(
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[1]::int,
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[2]::int
    );
    v_lo := LEAST(
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[1]::int,
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[2]::int
    );
    IF NOT (
      (v_hi = 6 AND v_lo <= 4)
      OR (v_hi = 7 AND v_lo IN (5, 6))
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        'Ugyldig padel-score. Gyldige resultater: 6-0 → 6-4, 7-5 eller 7-6'
      );
    END IF;
  END IF;

  UPDATE public.league_matches
  SET
    winner_id = p_winner_id,
    score_text = v_score,
    status = 'reported',
    reported_by = COALESCE(v_m.reported_by, v_admin)
  WHERE id = p_match_id;

  PERFORM public._admin_audit_log(
    'correct_league_match',
    NULL,
    jsonb_build_object('match_id', p_match_id, 'league_id', v_m.league_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'league_id', v_m.league_id,
    'winner_id', p_winner_id,
    'score_text', v_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_league_match(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_correct_league_match(uuid, uuid, text) TO authenticated;
