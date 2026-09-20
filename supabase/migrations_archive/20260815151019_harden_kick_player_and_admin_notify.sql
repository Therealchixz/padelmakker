-- Harden kick_player_from_match (notify before delete, jsonb errors, cancel/transfer)

-- Atomisk kick: opretter eller admin. Notificerer spilleren før sletning.
CREATE OR REPLACE FUNCTION public.kick_player_from_match(p_match_id uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_creator_id uuid;
  v_status text;
  v_remaining int;
  v_new_creator uuid;
  v_was_creator boolean;
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_is_admin := COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false);

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_locked');
  END IF;

  IF v_creator_id IS DISTINCT FROM v_caller AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_allowed');
  END IF;

  IF p_target_user_id = v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_kick_self');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = p_target_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_match');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (
    p_target_user_id,
    'match_cancelled',
    'Du er fjernet fra kampen ❌',
    'En admin/opretter har fjernet dig fra kampen.',
    p_match_id,
    false
  );

  v_was_creator := (v_creator_id = p_target_user_id);

  DELETE FROM public.match_players
  WHERE match_id = p_match_id AND user_id = p_target_user_id;

  SELECT COUNT(*) INTO v_remaining
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_remaining = 0 THEN
    UPDATE public.matches
    SET status = 'cancelled', current_players = 0, seeking_player = false
    WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'cancelled', true, 'remaining', 0);
  END IF;

  v_new_creator := v_creator_id;
  IF v_was_creator THEN
    SELECT mp.user_id INTO v_new_creator
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
    ORDER BY mp.user_id
    LIMIT 1;
  END IF;

  UPDATE public.matches
  SET creator_id = v_new_creator,
      status = 'open',
      current_players = v_remaining,
      seeking_player = false
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled', false,
    'remaining', v_remaining,
    'creator_transferred', v_was_creator,
    'new_creator_id', v_new_creator
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kick_player_from_match(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kick_player_from_match(uuid, uuid) TO authenticated;
