-- RPC til liga-holdinvitationer (omgår match_id-kravet i create_notification_for_user)
CREATE OR REPLACE FUNCTION public.notify_league_invite(
  p_user_id uuid,
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
  v_caller uuid;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  -- Kun tilladt hvis kalderen er player1 af et pending hold med modtageren som player2
  IF NOT EXISTS (
    SELECT 1 FROM public.league_teams lt
    WHERE lt.player1_id = v_caller
      AND lt.player2_id = p_user_id
      AND lt.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ingen adgang til at sende ligainvitation til denne bruger';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (p_user_id, 'team_invite', p_title, p_body, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_league_invite(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite(uuid, text, text) TO authenticated;
