-- Får mailene folk tilbage i appen?
--
-- Indtil nu vidste vi, hvor mange mails der blev sendt (email_send_log), men
-- ikke om nogen trykkede på dem. Hvert link i mailene får nu et mærke, fx
-- ?kilde=digest. Appen husker mærket, og når personen er logget ind, gemmes
-- én række her: hvem, fra hvilken mail, og hvornår.
--
-- Mærkerne:
--   digest       den daglige mail kl. 17
--   opdagelse    mailen om en kamp i dag eller i morgen
--   paamindelse  den ugentlige "kom tilbage"-påmindelse
--   winback      engangsmailen til dem, der ikke har været inde i 30 dage
--
-- Browseren kan ikke læse eller rette tabellen. Den kan kun kalde
-- log_app_return, som altid skriver for den, der er logget ind. Tallene ses
-- på admin-siden via admin_mail_return_stats.

CREATE TABLE IF NOT EXISTS public.app_returns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kilde text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_returns_kilde_created_idx
  ON public.app_returns (kilde, created_at DESC);
CREATE INDEX IF NOT EXISTS app_returns_user_created_idx
  ON public.app_returns (user_id, created_at DESC);

ALTER TABLE public.app_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_returns FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_app_return(p_kilde text, p_path text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_kilde text := lower(btrim(COALESCE(p_kilde, '')));
  v_path text := NULLIF(left(btrim(COALESCE(p_path, '')), 200), '');
BEGIN
  IF v_uid IS NULL OR v_kilde !~ '^[a-z0-9_-]{1,32}$' THEN
    RETURN false;
  END IF;
  IF v_path IS NOT NULL AND left(v_path, 1) <> '/' THEN
    v_path := NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RETURN false;
  END IF;
  -- Samme person, samme mail, inden for en halv time: ét besøg, ikke flere.
  IF EXISTS (
    SELECT 1 FROM public.app_returns r
    WHERE r.user_id = v_uid
      AND r.kilde = v_kilde
      AND r.created_at >= now() - interval '30 minutes'
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public.app_returns (user_id, kilde, path) VALUES (v_uid, v_kilde, v_path);
  RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_app_return(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_app_return(text, text) TO authenticated;

-- Pr. mail-slags: hvor mange forskellige personer kom tilbage, og hvor mange
-- besøg i alt. Mails sendt tælles fra email_send_log: "discovery" dækker den
-- daglige mail, hurtig-mailen og påmindelsen tilsammen (de deler én grænse på
-- én mail om dagen), "winback" er engangsmailen.
CREATE OR REPLACE FUNCTION public.admin_mail_return_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(1, LEAST(COALESCE(p_days, 30), 365)));
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Kun admin' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'days', GREATEST(1, LEAST(COALESCE(p_days, 30), 365)),
    'returns', COALESCE((
      SELECT jsonb_agg(x ORDER BY x.personer DESC, x.kilde)
      FROM (
        SELECT r.kilde, count(DISTINCT r.user_id)::integer AS personer, count(*)::integer AS besoeg
        FROM public.app_returns r
        WHERE r.created_at >= v_since
        GROUP BY r.kilde
      ) x
    ), '[]'::jsonb),
    'sent', COALESCE((
      SELECT jsonb_object_agg(s.kind, s.antal)
      FROM (
        SELECT l.kind, count(*)::integer AS antal
        FROM public.email_send_log l
        WHERE l.sent_at >= v_since
        GROUP BY l.kind
      ) s
    ), '{}'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_mail_return_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mail_return_stats(integer) TO authenticated;
