-- Slaa mails fra ud fra et token. Kaldes af edge-funktionen email-unsubscribe
-- med service_role - aldrig fra browseren.
--
-- Funktionen er bevidst tavs om, hvem token'et tilhoerer: den returnerer kun
-- ok/ukendt. Ellers ville linket kunne bruges til at slaa op, om en given
-- streng hoerer til en konto.
CREATE OR REPLACE FUNCTION public.email_unsubscribe_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_user uuid;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_token');
  END IF;

  SELECT t.user_id INTO v_user
  FROM public.email_unsubscribe_tokens t
  WHERE t.token = p_token;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_token');
  END IF;

  UPDATE public.profiles p
  SET notification_prefs = jsonb_set(
        COALESCE(p.notification_prefs, '{}'::jsonb),
        '{email}',
        COALESCE(p.notification_prefs->'email', '{}'::jsonb)
          || jsonb_build_object('opdagelse', false, 'afmeldt_at', to_jsonb(now())),
        true
      )
  WHERE p.id = v_user;

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.email_unsubscribe_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_unsubscribe_by_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.email_unsubscribe_by_token(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.email_unsubscribe_by_token(uuid) TO service_role;

-- Henter (og opretter ved behov) token'et til en bruger. Bruges af
-- send-discovery-email, naar linket skal saettes i mailen.
CREATE OR REPLACE FUNCTION public.email_unsub_token_for(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_token uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.email_unsubscribe_tokens (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT t.token INTO v_token
  FROM public.email_unsubscribe_tokens t
  WHERE t.user_id = p_user_id;

  RETURN v_token;
END;
$fn$;

REVOKE ALL ON FUNCTION public.email_unsub_token_for(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_unsub_token_for(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.email_unsub_token_for(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.email_unsub_token_for(uuid) TO service_role;
