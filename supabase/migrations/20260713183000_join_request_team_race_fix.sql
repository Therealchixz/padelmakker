-- Race-safe team assignment: lock match row before counting/inserting players.
-- Also adds notifications query index.

CREATE OR REPLACE FUNCTION approve_match_join_request(
  p_request_id UUID,
  p_match_id   UUID,
  p_user_id    UUID,
  p_user_name  TEXT,
  p_user_emoji TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_t1         INT;
  v_t2         INT;
  v_team_num   INT;
  v_new_count  INT;
  v_req_status text;
  v_on_team    INT;
BEGIN
  SELECT status
  INTO v_req_status
  FROM public.match_join_requests
  WHERE id = p_request_id
    AND match_id = p_match_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;

  IF lower(coalesce(v_req_status, '')) <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending');
  END IF;

  SELECT creator_id INTO v_creator_id
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;
  IF v_creator_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_creator');
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('approve_join', 60, 3600);
  END IF;

  UPDATE match_join_requests
  SET status = 'approved'
  WHERE id = p_request_id
    AND match_id = p_match_id
    AND user_id = p_user_id
    AND lower(coalesce(status, '')) = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending');
  END IF;

  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'match_full');
  END IF;

  v_team_num := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;

  IF (v_team_num = 1 AND v_t1 >= 2) OR (v_team_num = 2 AND v_t2 >= 2) THEN
    v_team_num := CASE WHEN v_team_num = 1 THEN 2 ELSE 1 END;
  END IF;

  IF (v_team_num = 1 AND v_t1 >= 2) OR (v_team_num = 2 AND v_t2 >= 2) THEN
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team_num);
  END IF;

  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, p_user_id, p_user_name, '', COALESCE(p_user_emoji, '🎾'), v_team_num)
  ON CONFLICT DO NOTHING;

  SELECT team INTO v_on_team
  FROM match_players
  WHERE match_id = p_match_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'insert_failed');
  END IF;

  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;

  IF v_t1 > 2 OR v_t2 > 2 THEN
    DELETE FROM match_players
    WHERE match_id = p_match_id AND user_id = p_user_id;
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team_num);
  END IF;

  SELECT COUNT(*) INTO v_new_count FROM match_players WHERE match_id = p_match_id;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE matches SET status = 'full', current_players = v_new_count, seeking_player = false WHERE id = p_match_id;
  ELSE
    UPDATE matches SET current_players = v_new_count WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', v_on_team);
END;
$$;

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
  WHERE m.id = p_match_id
  FOR UPDATE;

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

  IF v_t1 > 2 OR v_t2 > 2 THEN
    UPDATE public.match_players
    SET team = v_current_team
    WHERE match_id = p_match_id
      AND user_id = p_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', p_team);
  END IF;

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

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created
  ON public.notifications (user_id, type, created_at DESC);
