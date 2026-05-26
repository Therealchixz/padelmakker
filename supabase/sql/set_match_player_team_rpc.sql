-- SECURITY DEFINER: spillere kan skifte eget hold; opretter/admin kan flytte alle.
-- Direkte UPDATE på match_players fejler ofte stille pga. manglende RLS UPDATE-policy.
CREATE OR REPLACE FUNCTION public.set_match_player_team(
  p_match_id uuid,
  p_user_id uuid,
  p_team int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_creator_id uuid;
  v_status text;
  v_current_team int;
  v_t1 int;
  v_t2 int;
  v_target_count int;
  v_total int;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_team NOT IN (1, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_team');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  IF p_user_id <> v_caller
     AND v_creator_id <> v_caller
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT mp.team
  INTO v_current_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_in_match');
  END IF;

  IF v_current_team = p_team THEN
    RETURN jsonb_build_object('success', true, 'team', p_team, 'unchanged', true);
  END IF;

  SELECT COUNT(*)
  INTO v_target_count
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.team = p_team;

  IF v_target_count >= 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', p_team);
  END IF;

  UPDATE public.match_players
  SET team = p_team
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 1),
    COUNT(*) FILTER (WHERE team = 2),
    COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE public.matches
    SET status = 'full',
        current_players = v_total,
        seeking_player = false
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches
    SET status = 'open',
        current_players = v_total
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', p_team);
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_player_team(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_player_team(uuid, uuid, int) TO authenticated;
