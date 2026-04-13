-- =============================================================================
-- Migrering: Americano — spillervalg 5, 6 eller 7 (erstatter 8 / 12 / 16 i appen)
-- Kør i Supabase SQL Editor hvis americano_tournaments allerede har CHECK (8,12,16).
--
-- - 12 og 16 findes ikke i den nye model → sættes til 7 (tjek deltagere manuelt).
-- - Eksisterende turneringer med 8 bevares, så de stadig kan startes med 8 spillere.
-- =============================================================================

-- Vis hvor mange turneringer der påvirkes inden den destruktive opdatering
DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*)::int INTO cnt
  FROM public.americano_tournaments
  WHERE player_slots IN (12, 16);

  IF cnt = 0 THEN
    RAISE NOTICE 'Ingen turneringer med player_slots 12 eller 16 — migration er no-op.';
  ELSE
    RAISE NOTICE 'ADVARSEL: % turnering(er) med player_slots 12/16 sættes til 7. Tjek deltagerlister manuelt!', cnt;
  END IF;
END $$;

UPDATE public.americano_tournaments
SET player_slots = 7,
    updated_at = now()
WHERE player_slots IN (12, 16);

ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_player_slots_check;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_player_slots_check
  CHECK (player_slots IN (5, 6, 7, 8));
