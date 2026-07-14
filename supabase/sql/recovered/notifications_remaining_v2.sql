-- Remaining league + match notification RPCs.

CREATE OR REPLACE FUNCTION public.notify_league_invite_accepted(
  p_team_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_player1 uuid;
  v_league_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT lt.player1_id, lt.league_id
  INTO v_player1, v_league_id
  FROM public.league_teams lt
  WHERE lt.id = p_team_id
    AND lt.player2_id = v_caller
    AND lt.status = 'ready';

  IF v_player1 IS NULL THEN
    RAISE EXCEPTION 'Ingen adgang';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, read)
  VALUES (v_player1, 'team_invite', p_title, p_body, 'league', v_league_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_league_invite_accepted(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite_accepted(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_league_invite_declined(
  p_team_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_player1 uuid;
  v_league_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT lt.player1_id, lt.league_id
  INTO v_player1, v_league_id
  FROM public.league_teams lt
  WHERE lt.id = p_team_id
    AND lt.player2_id = v_caller;

  IF v_player1 IS NULL THEN
    RAISE EXCEPTION 'Ingen adgang';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, read)
  VALUES (v_player1, 'team_invite', p_title, p_body, 'league', v_league_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_league_invite_declined(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite_declined(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_match_creator_on_join(
  p_match_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_creator uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT creator_id INTO v_creator FROM public.matches WHERE id = p_match_id;
  IF v_creator IS NULL OR v_creator = v_caller THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Ikke tilmeldt kampen';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_invite', p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) TO authenticated;
