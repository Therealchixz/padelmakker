-- Stop tilmelding til Americano/Mexicano efter event-dato, og fjern anon
-- execute på expire_stale_play_intents (kun cron/service_role skal rydde).

CREATE OR REPLACE FUNCTION public.guard_americano_participant_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_slots integer;
  v_date date;
  v_count integer;
BEGIN
  SELECT t.status, t.player_slots, t.tournament_date
    INTO v_status, v_slots, v_date
  FROM public.americano_tournaments t
  WHERE t.id = NEW.tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF lower(coalesce(v_status, '')) <> 'registration'
     OR v_date < (timezone('Europe/Copenhagen', now()))::date THEN
    RAISE EXCEPTION 'tournament_not_open';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.americano_participants
  WHERE tournament_id = NEW.tournament_id;

  IF v_slots IS NOT NULL AND v_count >= v_slots THEN
    RAISE EXCEPTION 'tournament_full';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_play_intents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_play_intents() TO authenticated, service_role;
