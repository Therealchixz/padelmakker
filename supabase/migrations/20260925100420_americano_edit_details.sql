-- Ret en Americano/Mexicano: bane, dato og tid (ejeren 25. sep. 2026:
-- "Jeg kan stadigvæk ikke ændre det under americano").
--
-- 1) court_name: navnet på banen, når den ikke findes i courts (fx et center
--    fra listen uden courts-række, eller "Anden bane – skriv selv"). Før gik
--    navnet tabt, og turneringen viste "Bane ikke valgt".
-- 2) update_americano_details: kun opretteren (eller admin med kode), kun
--    mens tilmeldingen er åben, ikke til et tidspunkt der er passeret.
-- 3) public_americano_preview (kortet i Messenger/WhatsApp) bruger
--    court_name, når der ikke er en courts-række.

ALTER TABLE public.americano_tournaments ADD COLUMN IF NOT EXISTS court_name text;

DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'americano_tournaments_court_name_len_chk'
      AND conrelid = 'public.americano_tournaments'::regclass
  ) THEN
    ALTER TABLE public.americano_tournaments
      ADD CONSTRAINT americano_tournaments_court_name_len_chk
      CHECK (court_name IS NULL OR char_length(court_name) <= 60);
  END IF;
END
$chk$;

CREATE OR REPLACE FUNCTION public.update_americano_details(
  p_tournament_id uuid,
  p_date date,
  p_time_slot text,
  p_duration_minutes integer,
  p_court_id uuid,
  p_court_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_t public.americano_tournaments%ROWTYPE;
  v_court text := nullif(left(btrim(regexp_replace(COALESCE(p_court_name, ''), '\s+', ' ', 'g')), 60), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Du skal være logget ind';
  END IF;

  SELECT * INTO v_t FROM public.americano_tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turneringen findes ikke';
  END IF;
  IF v_t.creator_id IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun opretteren kan rette turneringen';
  END IF;
  IF COALESCE(v_t.status, '') <> 'registration' THEN
    RAISE EXCEPTION 'Turneringen kan kun rettes, før den er startet';
  END IF;

  IF p_date IS NULL OR COALESCE(p_time_slot, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Ugyldig dato eller tid';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 30 OR p_duration_minutes > 480 THEN
    RAISE EXCEPTION 'Ugyldig varighed';
  END IF;
  IF ((p_date + p_time_slot::time) AT TIME ZONE 'Europe/Copenhagen') < now() THEN
    RAISE EXCEPTION 'Tidspunktet er allerede passeret';
  END IF;
  IF p_court_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.courts c WHERE c.id = p_court_id) THEN
    RAISE EXCEPTION 'Ukendt bane';
  END IF;

  UPDATE public.americano_tournaments
     SET tournament_date = p_date,
         time_slot = p_time_slot,
         duration_minutes = p_duration_minutes,
         court_id = p_court_id,
         court_name = v_court,
         updated_at = now()
   WHERE id = p_tournament_id;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_americano_details(uuid, date, text, integer, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_americano_details(uuid, date, text, integer, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_americano_preview(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_t public.americano_tournaments%ROWTYPE;
  v_court text;
  v_participants bigint;
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
BEGIN
  SELECT * INTO v_t FROM public.americano_tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  IF v_t.status NOT IN ('registration', 'playing') THEN
    RETURN json_build_object('found', false, 'reason', 'not_available');
  END IF;

  IF v_t.tournament_date IS NOT NULL AND v_t.tournament_date < v_today AND v_t.status <> 'playing' THEN
    RETURN json_build_object('found', false, 'reason', 'past');
  END IF;

  SELECT c.name INTO v_court FROM public.courts c WHERE c.id = v_t.court_id;
  SELECT count(*)::bigint INTO v_participants
  FROM public.americano_participants ap
  WHERE ap.tournament_id = v_t.id;

  RETURN json_build_object(
    'found', true,
    'id', v_t.id,
    'name', v_t.name,
    'format', coalesce(v_t.format, 'americano'),
    'tournament_date', v_t.tournament_date,
    'time_slot', v_t.time_slot,
    'status', v_t.status,
    'player_slots', coalesce(v_t.player_slots, 0),
    'points_per_match', coalesce(v_t.points_per_match, 0),
    'participant_count', coalesce(v_participants, 0),
    'court_name', coalesce(nullif(trim(v_court), ''), nullif(trim(v_t.court_name), ''), 'Bane ikke angivet'),
    'description', left(coalesce(trim(v_t.description), ''), 280)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_americano_preview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_americano_preview(uuid) TO anon, authenticated;
