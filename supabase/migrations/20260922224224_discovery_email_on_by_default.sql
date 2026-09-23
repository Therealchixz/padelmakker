-- Mail om nye makkere/kampe var slaaet FRA som standard, og knappen ligger inde
-- i klokke-menuen. Resultat: 1 bruger ud af 98 havde fundet den.
--
-- Det er samme fejl som med selve makker-beskeden: en indstilling, ingen
-- finder, virker som om funktionen ikke findes. Standarden slaas til, og
-- teksten ved oprettelse fortaeller det.
--
-- Ingen faar deres valg overskrevet. Backfill'en rammer KUN profiler, der
-- slet ikke har en email-sektion - altsaa dem der aldrig har taget stilling.
-- Den ene bruger, der har slaaet mails FRA, beholder sit nej.
--
-- Forudsaetningen for at turde dette er allerede paa plads: frameldingen
-- virker nu med ét klik, uden login (20260922223016 / 20260922223032).

ALTER TABLE public.profiles
  ALTER COLUMN notification_prefs SET DEFAULT '{
    "push": {"chat": true, "liga": true, "kampe": true, "system": true, "resultat": true, "opdagelse": true, "invitation": true},
    "email": {"opdagelse": true}
  }'::jsonb;

UPDATE public.profiles
SET notification_prefs = jsonb_set(
      COALESCE(notification_prefs, '{}'::jsonb),
      '{email}',
      jsonb_build_object('opdagelse', true),
      true
    )
WHERE NOT (COALESCE(notification_prefs, '{}'::jsonb) ? 'email');
