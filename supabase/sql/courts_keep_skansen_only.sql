-- =============================================================================
-- Kun Skansen Padel-baner i "Baner" + Halbooking-link
-- =============================================================================
-- Kør i Supabase → SQL Editor.
--
-- 0) Hvis SELECT id, name, address FROM public.courts ikke viser nogen Skansen-række:
--    kør først courts_seed_skansen.sql (opretter banen + Halbooking-felter).
--
-- 1) Fejlen "invalid input syntax for type uuid" opstår hvis du bruger
--    teksten DIN-COURT-UUID-HER — det skal være et rigtigt UUID fra din tabel.
--    Find det med:
--      SELECT id, name, address FROM public.courts ORDER BY name;
--
-- 2) Denne fil beholder alle rækker i public.courts hvor navn eller adresse
--    ligner "Skansen" (inkl. varianter med å). JUSTÉR ILIKE-linjerne hvis dit
--    navn er helt anderledes.
--
-- 3) ADVARSEL: Sletter court_slots og bookings for baner der fjernes.
--    Opdaterer matches der pegede på andre baner, så de peger på én af de
--    baner der beholdes (så FK ikke blokerer). Tjek antal før/efter.
-- =============================================================================

-- ─── Trin A (valgfrit): se hvad der matches som "behold" ───────────────────
-- SELECT id, name, address
-- FROM public.courts
-- WHERE
--   name ILIKE '%skansen%' OR name ILIKE '%skånsen%'
--   OR address ILIKE '%skansen%' OR address ILIKE '%skånsen%';

BEGIN;

CREATE TEMP TABLE _pm_keep_courts ON COMMIT DROP AS
SELECT id
FROM public.courts
WHERE
  name ILIKE '%skansen%'
  OR name ILIKE '%skånsen%'
  OR address ILIKE '%skansen%'
  OR address ILIKE '%skånsen%';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _pm_keep_courts) THEN
    RAISE EXCEPTION
      'Ingen baner matchede Skansen. Kør: SELECT id, name, address FROM public.courts; og tilpas WHERE i scriptet.';
  END IF;
END $$;

-- Afhængige rækker for baner der slettes
DELETE FROM public.court_slots
WHERE court_id NOT IN (SELECT id FROM _pm_keep_courts);

DELETE FROM public.bookings
WHERE court_id NOT IN (SELECT id FROM _pm_keep_courts);

-- Matches der pegede på en bane der slettes: peg på første beholdte bane
-- (undgår FK-fejl; gamle kampe beholder deres court_name-tekst i matches hvis du har den kolonne).
UPDATE public.matches
SET court_id = (SELECT id FROM _pm_keep_courts ORDER BY name NULLS LAST LIMIT 1)
WHERE court_id IS NOT NULL
  AND court_id NOT IN (SELECT id FROM _pm_keep_courts);

-- Halbooking for alle beholdte Skansen-rækker
UPDATE public.courts
SET
  booking_provider = 'halbooking_ntsc',
  booking_url = COALESCE(
    NULLIF(trim(booking_url), ''),
    'https://ntsc.halbooking.dk/newlook/proc_baner.asp'
  )
WHERE id IN (SELECT id FROM _pm_keep_courts);

DELETE FROM public.courts
WHERE id NOT IN (SELECT id FROM _pm_keep_courts);

COMMIT;

-- Efter kørsel: Baner-fanen viser kun de tilbageværende + "Se ledige tider og book".
