-- Kør denne hvis du allerede har create_notification_for_user og notifications-tabel.
-- Tilføjer notify_match_creator_on_join (underret opretter ved tilmelding uden at læse creator_id fra klient).

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
  v_creator uuid;
  v_joiner uuid;
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('match_creator_join_notify', 20, 3600);
  END IF;

  SELECT m.creator_id INTO v_creator
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL OR v_creator = v_joiner THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_joiner
  ) THEN
    RAISE EXCEPTION 'Du er ikke tilmeldt denne kamp';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = v_creator
      AND n.match_id = p_match_id
      AND n.type = 'match_join'
      AND n.created_at > now() - interval '3 minutes'
      AND n.body = left(coalesce(p_body, ''), 500)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_join', p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) TO authenticated;
