-- Besked om nye kampe var slaaet FRA som standard. Kun 11 af 98 brugere havde
-- selv fundet knappen, saa en ny kamp kunne naa hoejst 11 mennesker - og efter
-- de oevrige filtre (region, aktivitet) i praksis 2 i hele landet.
--
-- Man skal bruge 4 mennesker til en padelkamp. Det var derfor 10 af 13 kampe
-- blev aflyst med under én spiller i gennemsnit, mens alle 3 kampe der naaede
-- fire spillere, blev spillet.
--
-- Ingen faar deres valg overskrevet: match_watch_at registrerer, hvornaar en
-- bruger selv har roert indstillingen. Alle 11 der har roert den, slog den TIL.
-- NUL har slaaet den fra. Backfill'en rammer kun de 87 der aldrig har taget
-- stilling, og lader match_watch_at vaere NULL, saa vi fortsat kan se forskel
-- paa "har valgt til" og "har ikke taget stilling".
--
-- Spam-spaerrerne er uaendrede: hoejst 8 modtagere per kamp og hoejst 5
-- discovery-beskeder per person per dag.

ALTER TABLE public.profiles
  ALTER COLUMN match_watch_enabled SET DEFAULT true;

UPDATE public.profiles
SET match_watch_enabled = true
WHERE match_watch_at IS NULL
  AND match_watch_enabled = false;
