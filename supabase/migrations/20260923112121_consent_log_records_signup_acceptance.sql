-- GDPR art. 7 stk. 1: "den dataansvarlige skal kunne paavise, at den
-- registrerede har givet samtykke".
--
-- Afkrydsningsfeltet paa /opret har altid vaeret obligatorisk, men svaret
-- levede kun i React-state. Det blev aldrig skrevet nogen steder. Spoerger en
-- bruger eller Datatilsynet "hvornaar accepterede han?", er der i dag intet
-- at svare med.
--
-- Loggen skrives af databasen, ikke af browseren, saa den ikke kan aendres
-- bagefter af den konto den handler om. Kilden er raw_user_meta_data, som
-- baade e-mail-oprettelse (signUp) og Google-oprettelse (updateUser) skriver
-- accepten til. Derfor skal triggeren lytte paa BEGGE: Google-brugeren
-- findes allerede, naar han krydser af.

CREATE TABLE IF NOT EXISTS public.consent_log (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  policy_version text NOT NULL,
  accepted_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text
);

-- Samme accept skal kun staa én gang. ON CONFLICT DO NOTHING nedenfor
-- laener sig op ad denne.
CREATE UNIQUE INDEX IF NOT EXISTS consent_log_user_kind_version_key
  ON public.consent_log (user_id, kind, policy_version);

CREATE INDEX IF NOT EXISTS consent_log_user_idx ON public.consent_log (user_id);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

-- Brugeren maa LAESE sin egen accept (art. 15, indsigt), men ikke skrive,
-- rette eller slette den. Ingen INSERT/UPDATE/DELETE-policy = ingen adgang.
DROP POLICY IF EXISTS consent_log_select_own ON public.consent_log;
CREATE POLICY consent_log_select_own ON public.consent_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.consent_log FROM PUBLIC;
REVOKE ALL ON TABLE public.consent_log FROM anon;
REVOKE ALL ON TABLE public.consent_log FROM authenticated;
GRANT SELECT ON TABLE public.consent_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.consent_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.consent_log_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.record_consent_from_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_at      timestamptz;
  v_version text;
  v_source  text;
BEGIN
  v_version := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'terms_version', '')), '');
  IF v_version IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_at := (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_at := NULL;
  END;

  IF v_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Et tidsstempel fra brugerens egen maskine kan staa forkert. Vi gemmer
  -- det som oplyst, men lader det aldrig give indtryk af en accept i
  -- fremtiden eller foer kontoen fandtes.
  IF v_at > now() + interval '1 day' THEN
    v_at := now();
  END IF;

  v_source := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'terms_source', '')), '');

  INSERT INTO public.consent_log (user_id, kind, policy_version, accepted_at, source)
  VALUES (NEW.id, 'terms_and_privacy', v_version, v_at, v_source)
  ON CONFLICT (user_id, kind, policy_version) DO NOTHING;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- En oprettelse maa aldrig fejle, fordi loggen ikke kunne skrives.
    RAISE WARNING 'record_consent_from_metadata failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_consent_from_metadata() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_consent_from_metadata() FROM anon;
REVOKE ALL ON FUNCTION public.record_consent_from_metadata() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_consent_recorded ON auth.users;
CREATE TRIGGER on_auth_user_consent_recorded
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_consent_from_metadata();
