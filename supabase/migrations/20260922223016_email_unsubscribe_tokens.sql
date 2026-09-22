-- Framelding af mails skal kunne ske med ET klik, uden login.
--
-- Hvorfor det er vigtigt: kan folk ikke komme af med en mail, trykker de
-- "spam" i stedet. Faar padelmakker.dk nok spam-markeringer, begynder Gmail og
-- Outlook at sortere ALLE domaenets mails fra - ogsaa "nulstil kodeord" og
-- "bekraeft din konto". Saa kan nye brugere ikke oprette sig. Frameldingen er
-- derfor ikke hoeflighed, den beskytter selve muligheden for at sende mail.
--
-- Token'et ligger i sin EGEN tabel, ikke paa profiles. Enhver indlogget bruger
-- kan laese alle profilraekker (Find makker viser alle 98), saa et token paa
-- profiles kunne laeses af hvem som helst og bruges til at afmelde andre.
--
-- Tabellen her er laast: RLS slaaet til UDEN politikker, og rettighederne
-- trukket eksplicit fra anon og authenticated. Det sidste er ikke pynt - nye
-- tabeller i public faar som standard ALLE rettigheder til begge roller, og
-- "REVOKE ... FROM PUBLIC" alene fjerner dem ikke.

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribe_tokens_token_key
  ON public.email_unsubscribe_tokens (token);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_unsubscribe_tokens FROM PUBLIC;
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon;
REVOKE ALL ON public.email_unsubscribe_tokens FROM authenticated;

-- Alle nuvaerende brugere skal have et token, saa den foerste mail kan baere
-- et frameldingslink.
INSERT INTO public.email_unsubscribe_tokens (user_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- Nye brugere faar et token med det samme. Uden triggeren ville en ny bruger
-- kunne naa at modtage en mail uden frameldingslink.
CREATE OR REPLACE FUNCTION public.ensure_email_unsub_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.email_unsubscribe_tokens (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_ensure_email_unsub_token ON public.profiles;
CREATE TRIGGER trg_ensure_email_unsub_token
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_email_unsub_token();
