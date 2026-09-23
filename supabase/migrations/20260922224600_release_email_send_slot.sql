-- Giv ugens reservation tilbage, hvis mailen alligevel ikke blev sendt.
--
-- Reservationen tages FOER afsendelsen, fordi funktionen kaldes fra browseren
-- og kan koere flere gange samtidig - ellers kunne to kald begge naa at sende.
-- Men fejler Resend bagefter, har brugeren brugt sin uge paa en mail, der
-- aldrig kom frem. Saa faar de ingenting i syv dage, uden at nogen opdager det.
--
-- Kun den nyeste reservation inden for det sidste minut gives tilbage: det er
-- den, kaldet selv lige har taget. Ellers kunne et fejlet kald frigive en
-- aeldre, gyldig reservation og aabne for en ekstra mail.
CREATE OR REPLACE FUNCTION public.release_email_send_slot(p_user_id uuid, p_kind text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_id bigint;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_kind), '') = '' THEN
    RETURN false;
  END IF;

  SELECT l.id INTO v_id
  FROM public.email_send_log l
  WHERE l.user_id = p_user_id
    AND l.kind = p_kind
    AND l.sent_at >= now() - interval '1 minute'
  ORDER BY l.sent_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.email_send_log WHERE id = v_id;
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.release_email_send_slot(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_email_send_slot(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.release_email_send_slot(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_email_send_slot(uuid, text) TO service_role;
