/**
 * Svar på et forslag. Når alle fire har sagt ja, oprettes kampen automatisk
 * med to spillere på hvert hold, og alle får besked.
 */
CREATE OR REPLACE FUNCTION public.respond_to_match_proposal(
  p_proposal_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_proposal public.match_proposals%ROWTYPE;
  v_pending integer;
  v_match_id uuid;
  v_row record;
  v_team integer := 1;
  v_seat integer := 0;
  v_title text;
  v_body text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_proposal
  FROM public.match_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forslaget findes ikke');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_proposal_members
    WHERE proposal_id = p_proposal_id AND user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Du er ikke med i dette forslag');
  END IF;

  IF v_proposal.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_proposal.status, 'match_id', v_proposal.match_id);
  END IF;

  IF v_proposal.expires_at <= now() THEN
    UPDATE public.match_proposals SET status = 'expired' WHERE id = p_proposal_id;
    UPDATE public.play_intents SET status = 'expired'
    WHERE proposal_id = p_proposal_id AND status = 'proposed';
    RETURN jsonb_build_object('ok', true, 'status', 'expired');
  END IF;

  UPDATE public.match_proposal_members
  SET response = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE proposal_id = p_proposal_id AND user_id = v_caller;

  IF NOT p_accept THEN
    UPDATE public.match_proposals SET status = 'declined' WHERE id = p_proposal_id;

    -- Den der sagde nej trækkes ud; de øvrige ryger tilbage i puljen.
    UPDATE public.play_intents SET status = 'cancelled', proposal_id = NULL
    WHERE proposal_id = p_proposal_id AND user_id = v_caller;

    UPDATE public.play_intents SET status = 'open', proposal_id = NULL
    WHERE proposal_id = p_proposal_id AND status = 'proposed';

    INSERT INTO public.notifications
      (user_id, type, title, body, match_id, entity_type, entity_id, read)
    SELECT m.user_id,
           'match_proposal_declined',
           'Kampen blev ikke til noget',
           'En spiller kunne ikke alligevel. Du står stadig klar i puljen.',
           NULL, 'match_proposal', p_proposal_id, false
    FROM public.match_proposal_members m
    WHERE m.proposal_id = p_proposal_id AND m.user_id <> v_caller;

    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  SELECT COUNT(*) INTO v_pending
  FROM public.match_proposal_members
  WHERE proposal_id = p_proposal_id AND response <> 'accepted';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'pending', 'awaiting', v_pending);
  END IF;

  INSERT INTO public.matches (creator_id, date, "time", time_end, status, max_players, current_players, description)
  VALUES (
    (SELECT user_id FROM public.match_proposal_members
      WHERE proposal_id = p_proposal_id ORDER BY responded_at NULLS LAST LIMIT 1),
    v_proposal.play_date,
    to_char(v_proposal.start_time, 'HH24:MI'),
    to_char(v_proposal.end_time, 'HH24:MI'),
    'full',
    4,
    4,
    'Samlet automatisk af PadelMakker — husk at booke bane'
  )
  RETURNING id INTO v_match_id;

  FOR v_row IN
    SELECT m.user_id,
           COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.name), ''), 'Spiller') AS navn,
           COALESCE(NULLIF(btrim(p.avatar_emoji), ''), '🎾') AS emoji
    FROM public.match_proposal_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.proposal_id = p_proposal_id
    ORDER BY m.responded_at NULLS LAST, m.user_id
  LOOP
    v_team := CASE WHEN v_seat < 2 THEN 1 ELSE 2 END;
    INSERT INTO public.match_players (match_id, user_id, user_name, user_emoji, team)
    VALUES (v_match_id, v_row.user_id, v_row.navn, v_row.emoji, v_team);
    v_seat := v_seat + 1;
  END LOOP;

  UPDATE public.match_proposals
  SET status = 'confirmed', match_id = v_match_id
  WHERE id = p_proposal_id;

  UPDATE public.play_intents SET status = 'matched'
  WHERE proposal_id = p_proposal_id;

  v_title := 'Kampen er booket ind';
  v_body := format(
    'Alle fire har bekræftet %s kl. %s. Aftal bane i chatten.',
    to_char(v_proposal.play_date, 'DD/MM'),
    to_char(v_proposal.start_time, 'HH24:MI')
  );

  INSERT INTO public.notifications
    (user_id, type, title, body, match_id, entity_type, entity_id, read)
  SELECT m.user_id, 'match_proposal_confirmed', v_title, v_body, v_match_id, 'match', v_match_id, false
  FROM public.match_proposal_members m
  WHERE m.proposal_id = p_proposal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'match_id', v_match_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_match_proposal(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_match_proposal(uuid, boolean) TO authenticated;
