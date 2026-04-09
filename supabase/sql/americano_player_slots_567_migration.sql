-- =============================================================================
-- Migrering: Americano — spillervalg 5, 6 eller 7 (erstatter 8 / 12 / 16 i appen)
-- Kør i Supabase SQL Editor hvis americano_tournaments allerede har CHECK (8,12,16).
--
-- - 12 og 16 findes ikke i den nye model → sættes til 7 (tjek deltagere manuelt).
-- - Eksisterende turneringer med 8 bevares, så de stadig kan startes med 8 spillere.
-- =============================================================================

UPDATE public.americano_tournaments
SET player_slots = 7,
    updated_at = now()
WHERE player_slots IN (12, 16);

ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_player_slots_check;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_player_slots_check
  CHECK (player_slots IN (5, 6, 7, 8));
