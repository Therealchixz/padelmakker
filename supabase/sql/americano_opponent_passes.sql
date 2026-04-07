-- =============================================================================
-- Americano: 1 eller 2 gennemgang af rundeplan (længere turnering / flere møder)
-- Kør i Supabase SQL Editor efter americano_tournaments findes.
-- =============================================================================

ALTER TABLE public.americano_tournaments
  ADD COLUMN IF NOT EXISTS opponent_passes integer NOT NULL DEFAULT 1;

ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_opponent_passes_check;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_opponent_passes_check
  CHECK (opponent_passes IN (1, 2));

UPDATE public.americano_tournaments
SET opponent_passes = 1
WHERE opponent_passes IS NULL;
