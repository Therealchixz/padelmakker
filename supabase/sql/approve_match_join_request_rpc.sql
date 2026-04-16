-- SECURITY DEFINER RPC: opretter godkender tilmeldingsanmodning og indsætter
-- spilleren i match_players uden at RLS blokerer (creator må ikke indsætte
-- på vegne af en anden bruger via direkte INSERT).
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
BEGIN
  -- Kun opretter (eller admin) må godkende
  SELECT creator_id INTO v_creator_id FROM matches WHERE id = p_match_id;
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;
  IF v_creator_id <> auth.uid() AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_creator');
  END IF;

  -- Sæt anmodning til godkendt
  UPDATE match_join_requests
  SET status = 'approved'
  WHERE id = p_request_id;

  -- Find holdet med færrest spillere
  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;
  v_team_num := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;

  -- Indsæt spilleren (bypasser RLS via SECURITY DEFINER)
  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, p_user_id, p_user_name, '', COALESCE(p_user_emoji, '🎾'), v_team_num)
  ON CONFLICT DO NOTHING;

  -- Opdater spillerantal / status
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
