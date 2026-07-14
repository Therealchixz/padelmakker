-- ─────────────────────────────────────────────────────────────
-- On-court-spillere kan indberette deres egen banes resultat
-- (Americano/Mexicano). Opretteren beholder fuld ret via RLS.
-- Anvendt på remote DB 2026-06-15.
-- Opdateret: server-side vagt mod at låse en senere runde før
-- alle tidligere runders resultater er indberettet.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_americano_match_score(
  p_match_id uuid,
  p_score_a int,
  p_score_b int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match public.americano_matches%ROWTYPE;
  v_ppm int;
  v_status text;
  v_is_player boolean;
  v_earlier_open boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_match FROM public.americano_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  -- Kun aktiv (ulåst) kamp må indberettes via denne vej
  IF COALESCE(v_match.results_locked, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_locked');
  END IF;

  -- Turneringen skal være i gang
  SELECT status, points_per_match INTO v_status, v_ppm
  FROM public.americano_tournaments WHERE id = v_match.tournament_id;
  IF v_status <> 'playing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'tournament_not_playing');
  END IF;

  -- Kalderen skal være én af de 4 spillere på netop denne bane
  SELECT EXISTS (
    SELECT 1 FROM public.americano_participants ap
    WHERE ap.user_id = v_uid
      AND ap.id IN (v_match.team_a_p1, v_match.team_a_p2, v_match.team_b_p1, v_match.team_b_p2)
  ) INTO v_is_player;
  IF NOT v_is_player THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_on_court');
  END IF;

  -- Håndhæv rækkefølgen: alle tidligere runder skal være færdigspillede (låst),
  -- før en senere runde kan indberettes. Ellers kunne en spiller låse en
  -- fremtidig runde (der oprettes ulåst ved turneringsstart) før tur.
  SELECT EXISTS (
    SELECT 1 FROM public.americano_matches am
    WHERE am.tournament_id = v_match.tournament_id
      AND am.round_number < v_match.round_number
      AND COALESCE(am.results_locked, false) = false
  ) INTO v_earlier_open;
  IF v_earlier_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'earlier_round_open');
  END IF;

  -- Valider score: ikke-negativ, og summen skal være præcis points_per_match
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a < 0 OR p_score_b < 0
     OR (p_score_a + p_score_b) <> v_ppm THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_score');
  END IF;

  -- Skriv kun score-kolonnerne + lås
  UPDATE public.americano_matches
  SET team_a_score = p_score_a,
      team_b_score = p_score_b,
      results_locked = true,
      updated_at = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.report_americano_match_score(uuid, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.report_americano_match_score(uuid, int, int) TO authenticated;
