-- Skip per-row recalc during admin batch; force final profile ELO to p_new_elo

CREATE OR REPLACE FUNCTION public.trg_americano_elo_history_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid;
BEGIN
  IF COALESCE(current_setting('app.skip_americano_elo_sync', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  uid := COALESCE(NEW.user_id, OLD.user_id);
  IF uid IS NOT NULL THEN
    PERFORM public.recalc_americano_elo_from_history(uid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_americano_elo(p_user_id uuid, p_new_elo int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_current_elo int;
  v_target_base int;
  v_played int := 0;
  v_total_change int := 0;
  v_running_rating int;
  v_row record;
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

  IF EXISTS (
    SELECT 1 FROM public.americano_elo_history h WHERE h.user_id = p_user_id
  ) THEN
    SELECT COALESCE(SUM(change), 0)::int
    INTO v_total_change
    FROM public.americano_elo_history
    WHERE user_id = p_user_id;

    v_target_base := p_new_elo - v_total_change;
    v_running_rating := v_target_base;

    PERFORM set_config('app.skip_americano_elo_sync', '1', true);

    FOR v_row IN
      SELECT id, change
      FROM public.americano_elo_history
      WHERE user_id = p_user_id
      ORDER BY created_at ASC, tournament_id ASC, id ASC
    LOOP
      UPDATE public.americano_elo_history
      SET
        old_rating = v_running_rating,
        new_rating = v_running_rating + COALESCE(v_row.change, 0)
      WHERE id = v_row.id;

      v_running_rating := v_running_rating + COALESCE(v_row.change, 0);
    END LOOP;

    PERFORM set_config('app.skip_americano_elo_sync', '0', true);

    PERFORM public.recalc_americano_elo_from_history(p_user_id);

    SELECT COUNT(*)::int
    INTO v_played
    FROM public.americano_elo_history
    WHERE user_id = p_user_id;

    UPDATE public.profiles
    SET
      americano_elo_rating = p_new_elo,
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
