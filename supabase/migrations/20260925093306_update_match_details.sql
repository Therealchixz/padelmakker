-- Ret en oprettet kamp: bane, dato og tid.
--
-- Ejeren 25. sep. 2026: startede man en kamp uden bane, kunne man ikke gå
-- tilbage og vælge den, når man fandt en, eller flytte tiden. Appen må kun
-- opdatere få kolonner i matches direkte (kolonne-rettigheder), så ændringen
-- går gennem denne funktion:
--   - kun kampens opretter (eller admin med kode)
--   - kun mens kampen er åben eller fuld (ikke startet, afsluttet, aflyst)
--   - ikke til et tidspunkt, der er passeret
--   - niveauet bevares; kun "booket"-mærket i level_range skiftes
-- Beskeden til de andre spillere sender appen i kamp-chatten.

CREATE OR REPLACE FUNCTION public.update_match_details(
  p_match_id uuid,
  p_date date,
  p_time text,
  p_time_end text,
  p_court_id uuid,
  p_court_name text,
  p_court_booked boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_m public.matches%ROWTYPE;
  v_level text;
  v_court text := left(btrim(COALESCE(p_court_name, '')), 120);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Du skal være logget ind';
  END IF;

  SELECT * INTO v_m FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kampen findes ikke';
  END IF;
  IF v_m.creator_id IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun kampens opretter kan rette kampen';
  END IF;
  IF COALESCE(v_m.status, '') NOT IN ('open', 'full') THEN
    RAISE EXCEPTION 'Kampen kan kun rettes, før den er startet';
  END IF;

  IF p_date IS NULL
     OR COALESCE(p_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR COALESCE(p_time_end, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Ugyldig dato eller tid';
  END IF;
  IF ((p_date + p_time::time) AT TIME ZONE 'Europe/Copenhagen') < now() THEN
    RAISE EXCEPTION 'Tidspunktet er allerede passeret';
  END IF;
  IF p_court_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.courts c WHERE c.id = p_court_id) THEN
    RAISE EXCEPTION 'Ukendt bane';
  END IF;
  IF COALESCE(p_court_booked, false) AND p_court_id IS NULL AND v_court = '' THEN
    RAISE EXCEPTION 'Vælg det center, hvor banen er booket';
  END IF;

  v_level := COALESCE(v_m.level_range, '');
  IF v_level ~* 'booked:(yes|no)' THEN
    v_level := regexp_replace(v_level, 'booked:(yes|no)', 'booked:' || CASE WHEN p_court_booked THEN 'yes' ELSE 'no' END, 'i');
  ELSIF v_level = '' THEN
    v_level := 'booked:' || CASE WHEN p_court_booked THEN 'yes' ELSE 'no' END;
  ELSE
    v_level := v_level || '|booked:' || CASE WHEN p_court_booked THEN 'yes' ELSE 'no' END;
  END IF;

  UPDATE public.matches
     SET date = p_date,
         time = p_time,
         time_end = p_time_end,
         court_id = p_court_id,
         court_name = v_court,
         level_range = v_level
   WHERE id = p_match_id;

  RETURN jsonb_build_object('ok', true, 'level_range', v_level);
END;
$fn$;

REVOKE ALL ON FUNCTION public.update_match_details(uuid, date, text, text, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_match_details(uuid, date, text, text, uuid, text, boolean) TO authenticated;
