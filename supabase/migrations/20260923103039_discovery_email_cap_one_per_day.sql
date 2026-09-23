-- Ugespaerren paa opdagelses-mails var sat for stramt.
--
-- Den blev sat for at gardere mod, at fem forskellige mennesker starter en
-- soegning samme dag og udloeser fem mails. Det scenarie er ikke sket, og
-- prisen er maalt: af de uger hvor nogen overhovedet fik en besked, havde
-- 2 ud af 3 mere end én. Hoejeste var 3 paa en uge. Spaerren slugte altsaa
-- den anden og tredje besked i en travl uge.
--
-- Oveni er der et timing-problem: en der soeger makker i dag vil spille i den
-- naermeste fremtid. Hoerer man foerst om dem naeste uge, er det for sent.
--
-- Graensen er nu én mail per dag. Vaerst taenkeligt bliver 7 paa en uge i
-- stedet for 1, realistisk 1-2. De oevrige spaerrer staar uroerte: 8
-- modtagere per soegning, 5 beskeder per person per dag, og man hoerer aldrig
-- om den SAMME person to gange inden for 7 dage.
--
-- Kun standardvaerdien aendres. Kaldet i send-discovery-email sender ingen
-- interval med, saa den arver den nye graense.

CREATE OR REPLACE FUNCTION public.claim_email_send_slot(
  p_user_id uuid,
  p_kind text,
  p_min_interval interval DEFAULT interval '1 day'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_recent boolean;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_kind), '') = '' THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_kind));

  SELECT EXISTS (
    SELECT 1 FROM public.email_send_log l
    WHERE l.user_id = p_user_id
      AND l.kind = p_kind
      AND l.sent_at >= now() - p_min_interval
  ) INTO v_recent;

  IF v_recent THEN
    RETURN false;
  END IF;

  INSERT INTO public.email_send_log (user_id, kind) VALUES (p_user_id, p_kind);
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.claim_email_send_slot(uuid, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_email_send_slot(uuid, text, interval) FROM anon;
REVOKE ALL ON FUNCTION public.claim_email_send_slot(uuid, text, interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_send_slot(uuid, text, interval) TO service_role;
