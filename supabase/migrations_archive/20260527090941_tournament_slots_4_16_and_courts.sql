-- =============================================================================
-- Udvid Americano/Mexicano turneringer: player_slots 4–16 + courts_per_round
-- =============================================================================

-- 1. Udvid player_slots check til 4..16
ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_player_slots_check;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_player_slots_check
  CHECK (player_slots BETWEEN 4 AND 16);

-- 2. Tilføj courts_per_round (antal baner pr. runde; 1 = klassisk, >1 = parallelle kampe)
ALTER TABLE public.americano_tournaments
  ADD COLUMN IF NOT EXISTS courts_per_round integer NOT NULL DEFAULT 1;

-- Sæt constraint: mindst 1, højest floor(player_slots/4)
ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_courts_per_round_check;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_courts_per_round_check
  CHECK (courts_per_round >= 1 AND courts_per_round <= (player_slots / 4));

COMMENT ON COLUMN public.americano_tournaments.courts_per_round IS
  'Antal parallelle baner pr. runde. 1 = klassisk (én kamp ad gangen, resten bænket). Maks floor(player_slots/4).';
