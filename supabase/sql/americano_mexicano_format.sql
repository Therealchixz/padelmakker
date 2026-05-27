-- Americano vs Mexicano turneringsformat på samme tabeller.
-- americano = fast rundeplan ved start
-- mexicano = runde 1 ved start, derefter dynamisk parring efter stilling

ALTER TABLE public.americano_tournaments
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'americano';

ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_format_check;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_format_check
  CHECK (format IN ('americano', 'mexicano'));

COMMENT ON COLUMN public.americano_tournaments.format IS
  'americano: forudgenereret rotation. mexicano: næste runde bygges ud fra stilling (1+4 vs 2+3 på banen).';
