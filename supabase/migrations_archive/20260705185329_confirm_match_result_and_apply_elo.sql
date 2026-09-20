-- Atomisk bekræftelse + ELO: rollback af confirmed hvis ELO fejler.
CREATE OR REPLACE FUNCTION public.confirm_match_result_and_apply_elo(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_mr public.match_results%ROWTYPE;
  v_uid uuid := auth.uid();
  v_elo jsonb;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_mr FROM public.match_results WHERE id = p_match_result_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Resultat ikke fundet');
  END IF;

  IF v_mr.confirmed IS TRUE THEN
    RETURN jsonb_build_object('error', 'Resultatet er allerede bekræftet');
  END IF;

  IF to_regprocedure('public.is_user_admin_verified(uuid)') IS NOT NULL
     AND public.is_user_admin_verified(v_uid) THEN
    v_allowed := true;
  ELSIF to_regprocedure('public.can_confirm_match_result(uuid, uuid, uuid)') IS NOT NULL
        AND public.can_confirm_match_result(v_mr.match_id, v_mr.submitted_by, v_uid) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'Resultatet skal bekræftes af en spiller fra modstanderholdet.');
  END IF;

  UPDATE public.match_results
  SET confirmed = true, confirmed_by = v_uid
  WHERE id = p_match_result_id;

  v_elo := public.apply_elo_for_match(p_match_result_id);

  IF v_elo IS NULL OR (v_elo ? 'error') THEN
    RAISE EXCEPTION 'ELO application failed: %', COALESCE(v_elo->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'elo', v_elo);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_match_result_and_apply_elo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_match_result_and_apply_elo(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
