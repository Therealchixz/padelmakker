-- =============================================================================
-- Americano: lås kampresultat efter "Gem" — kun opretter kan rette (app låser op)
-- Kør i Supabase SQL Editor efter americano_matches findes.
-- =============================================================================

BEGIN;

ALTER TABLE public.americano_matches
  ADD COLUMN IF NOT EXISTS results_locked boolean NOT NULL DEFAULT false;

-- Eksisterende gemte resultater betragtes som låst
UPDATE public.americano_matches
SET results_locked = true
WHERE team_a_score IS NOT NULL
  AND team_b_score IS NOT NULL
  AND results_locked = false;

COMMIT;
