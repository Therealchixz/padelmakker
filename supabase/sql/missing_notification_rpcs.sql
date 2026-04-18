-- =============================================================================
-- Manglende notifikations-RPCs
-- Kør i Supabase → SQL Editor
-- =============================================================================

-- =============================================================================
-- 1) notify_creator_join_request
--    Kaldes når en spiller anmoder om at deltage i en lukket kamp.
--    Opretter (tilmeldt til ansøger) er IKKE i match_players endnu,
--    så vi kan ikke bruge den generelle create_notification_for_user.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_creator_join_request(
  p_match_id uuid,
  p_title    text,
  p_body     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller  uuid;
  v_creator uuid;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  -- Find kampopretter
  SELECT creator_id INTO v_creator
  FROM public.matches
  WHERE id = p_match_id;

  IF v_creator IS NULL THEN
    RETURN; -- Kamp ikke fundet
  END IF;

  -- Underret ikke dig selv
  IF v_creator = v_caller THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_invite', p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_creator_join_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_creator_join_request(uuid, text, text) TO authenticated;


-- =============================================================================
-- 2) notify_league_invite_accepted
--    Kaldes når player2 accepterer en holdinvitation.
--    Notificerer player1 (invitøren).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_league_invite_accepted(
  p_team_id uuid,
  p_title   text,
  p_body    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller   uuid;
  v_player1  uuid;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  -- Find holdet og verificer at kalderen er player2
  SELECT player1_id INTO v_player1
  FROM public.league_teams
  WHERE id = p_team_id
    AND player2_id = v_caller;

  IF v_player1 IS NULL THEN
    RAISE EXCEPTION 'Ingen adgang: du er ikke player2 på dette hold';
  END IF;

  -- Underret ikke dig selv
  IF v_player1 = v_caller THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (v_player1, 'team_invite', p_title, p_body, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_league_invite_accepted(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite_accepted(uuid, text, text) TO authenticated;
