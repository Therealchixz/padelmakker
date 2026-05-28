-- =============================================================================
-- Admin: Juster Americano/Mexicano ELO manuelt
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_adjust_americano_elo(p_user_id uuid, p_new_elo int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_elo int;
  v_first_id uuid;
  v_diff int;
  v_sum_change int := 0;
  v_played int := 0;
  v_base int := NULL;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Adgang nægtet: Kun admins kan justere Americano/Mexicano ELO manuelt.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Mangler bruger-id';
  END IF;

  IF p_new_elo IS NULL OR p_new_elo < 100 THEN
    RAISE EXCEPTION 'Ugyldig ELO-værdi (min 100).';
  END IF;

  SELECT COALESCE(americano_elo_rating, 1000)::int
  INTO v_current_elo
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_elo IS NULL THEN
    RAISE EXCEPTION 'Brugerprofil ikke fundet';
  END IF;

  SELECT id
  INTO v_first_id
  FROM public.americano_elo_history
  WHERE user_id = p_user_id
    AND old_rating IS NOT NULL
  ORDER BY created_at ASC, tournament_id ASC, id ASC
  LIMIT 1;

  IF v_first_id IS NOT NULL THEN
    v_diff := p_new_elo - v_current_elo;
    UPDATE public.americano_elo_history
    SET old_rating = old_rating + v_diff
    WHERE id = v_first_id;

    SELECT
      MIN(old_rating)::int,
      COALESCE(SUM(change), 0)::int,
      COUNT(*)::int
    INTO v_base, v_sum_change, v_played
    FROM public.americano_elo_history
    WHERE user_id = p_user_id;

    UPDATE public.profiles
    SET
      americano_elo_rating = GREATEST(100, COALESCE(v_base, p_new_elo) + COALESCE(v_sum_change, 0)),
      americano_played = COALESCE(v_played, americano_played)
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET americano_elo_rating = p_new_elo
    WHERE id = p_user_id;
  END IF;

  PERFORM public._admin_audit_log(
    'adjust_americano_elo',
    p_user_id,
    jsonb_build_object('new_elo', p_new_elo, 'previous_elo', v_current_elo)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_americano_elo(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_americano_elo(uuid, int) TO authenticated;
