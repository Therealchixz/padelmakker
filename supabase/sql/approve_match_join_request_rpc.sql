-- SECURITY DEFINER RPC: opretter godkender tilmeldingsanmodning og indsætter
-- spilleren i match_players uden at RLS blokerer (creator må ikke indsætte
-- på vegne af en anden bruger via direkte INSERT).
-- Kræver security_hardening_phase2.sql for rate limit + pending-validering.
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
BEGIN
  SELECT creator_id INTO v_creator_id FROM matches WHERE id = p_match_id;
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;
  IF v_creator_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_creator');
  END IF;

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
  v_team_num := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;

  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, p_user_id, p_user_name, '', COALESCE(p_user_emoji, '🎾'), v_team_num)
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO v_new_count FROM match_players WHERE match_id = p_match_id;

  IF v_t1 + (CASE WHEN v_team_num = 1 THEN 1 ELSE 0 END) >= 2
     AND v_t2 + (CASE WHEN v_team_num = 2 THEN 1 ELSE 0 END) >= 2 THEN
    UPDATE matches SET status = 'full', current_players = v_new_count, seeking_player = false WHERE id = p_match_id;
  ELSE
    UPDATE matches SET current_players = v_new_count WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', v_team_num);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_match_join_request(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
