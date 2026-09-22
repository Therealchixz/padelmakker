-- Samme aendring som kamp-siden fik (20260922210639): besked om nye makkere var
-- slaaet FRA som standard. 11 af 98 havde selv fundet knappen, og efter
-- aktivitetsfilteret kunne 2 mennesker i hele landet modtage beskeden.
--
-- Ingen faar deres valg overskrevet: makker_watch_at registrerer, hvornaar en
-- bruger selv har roert indstillingen. Backfill'en rammer kun dem der aldrig
-- har taget stilling.
--
-- Spam-spaerrerne er uaendrede: hoejst 8 modtagere per soegning og hoejst 5
-- discovery-beskeder per person per dag.

ALTER TABLE public.profiles
  ALTER COLUMN makker_watch_enabled SET DEFAULT true;

UPDATE public.profiles
SET makker_watch_enabled = true
WHERE makker_watch_at IS NULL
  AND makker_watch_enabled = false;
