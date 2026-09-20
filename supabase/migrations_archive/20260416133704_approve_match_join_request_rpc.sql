-- Migration 20260416133704_approve_match_join_request_rpc
-- Backfilled from sql:approve_match_join_request_rpc.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- SECURITY DEFINER RPC: opretter godkender tilmeldingsanmodning og indsætter
-- spilleren i match_players uden at RLS blokerer (creator må ikke indsætte
-- på vegne af en anden bruger via direkte INSERT).
-- Kræver security_hardening_phase2.sql for rate limit + pending-validering.
-- Race-safe: låser match-rækken (FOR UPDATE) — se join_request_team_race_fix.sql
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

REVOKE ALL ON FUNCTION approve_match_join_request(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_match_join_request(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
