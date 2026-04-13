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
  v_joiner := (SELECT auth.uid());
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT m.creator_id INTO v_creator
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_creator IS NULL THEN
    RETURN;
  END IF;

  IF v_creator = v_joiner THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_joiner
  ) THEN
    RAISE EXCEPTION 'Du er ikke tilmeldt denne kamp';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_join', p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_creator_on_join(uuid, text, text) TO authenticated;
