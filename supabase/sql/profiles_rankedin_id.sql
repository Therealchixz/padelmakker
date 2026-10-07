-- Rankedin-profil paa PadelMakker-profilen (ejeren 7. okt. 2026: troevaerdighed).
--
-- Kun Rankedin-nummeret gemmes (fx R000123456), aldrig en fri URL: appen bygger
-- selv adressen til rankedin.com, saa et profilfelt aldrig kan pege paa en
-- vilkaarlig side. Formatet er Rankedins eget (et bogstav D-R + 9-14 tegn).
--
-- Kan koeres flere gange (blev lagt ind foer frontenden, fordi profilen
-- hentes med en fast kolonneliste).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rankedin_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_rankedin_id_format' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_rankedin_id_format
      CHECK (rankedin_id IS NULL OR rankedin_id ~ '^[D-R][A-Za-z0-9]{9,14}$');
  END IF;
END $$;

-- profiles har kolonne-vise laeserettigheder (email er skjult); nye kolonner
-- skal derfor gives eksplicit. Opdatering er allerede tilladt paa tabellen,
-- og RLS sikrer, at man kun kan rette sin egen profil.
GRANT SELECT (rankedin_id) ON public.profiles TO authenticated;
