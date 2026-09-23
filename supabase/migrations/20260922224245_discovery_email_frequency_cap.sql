-- Hoejst én opdagelses-mail per person per uge.
--
-- Uden dette kunne en bruger faa op til 5 mails om dagen: notifikations-
-- funktionen spaerrer for gentagelser om SAMME person i 7 dage, men fem
-- FORSKELLIGE makkere paa én dag er inden for reglerne. Fem mails paa en dag
-- til en, der ikke har aabnet appen i et halvt aar, er praecis det, der faar
-- folk til at trykke spam.
--
-- Spaerren ligger i databasen, ikke i edge-funktionen: funktionen kaldes fra
-- browseren og kan koere flere gange samtidig. En INSERT der enten lykkes
-- eller ikke lykkes er den eneste maade at taelle rigtigt paa, naar to kald
-- rammer samtidig.

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_send_log_user_kind_sent_idx
  ON public.email_send_log (user_id, kind, sent_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_send_log FROM PUBLIC;
REVOKE ALL ON public.email_send_log FROM anon;
REVOKE ALL ON public.email_send_log FROM authenticated;

-- Reserverer retten til at sende. Returnerer true hoejst én gang per uge per
-- bruger og type. Raekkelaasen gaelder, til transaktionen er slut, saa to
-- samtidige kald ikke begge faar lov.
CREATE OR REPLACE FUNCTION public.claim_email_send_slot(
  p_user_id uuid,
  p_kind text,
  p_min_interval interval DEFAULT interval '7 days'
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
