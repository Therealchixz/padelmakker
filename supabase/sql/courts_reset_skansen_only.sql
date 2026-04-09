-- =============================================================================
-- Nulstil baner: kun én rigtig række (Skansen Padel) til Kampe/Americano-dropdown
-- =============================================================================
-- Fanen "Baner" i appen bruger Halbooking-live — `courts` er til banevalg ved kamp/tournament.
--
-- Kør først (hvis ikke allerede): supabase/sql/courts_booking_url.sql
--
-- ADVARSEL: Sletter court_slots og bookings. Alle kampe/americano peges på den nye bane.
-- =============================================================================

BEGIN;

ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS booking_provider text;

DELETE FROM public.court_slots;
DELETE FROM public.bookings;

DO $$
DECLARE
  nid uuid;
BEGIN
  INSERT INTO public.courts (
    name,
    address,
    is_indoor,
    price_per_hour,
    rating,
    booking_provider,
    booking_url
  )
  VALUES (
    'Skansen Padel',
    'Lerumbakken 11, 9400 Nørresundby',
    true,
    0,
    NULL,
    'halbooking_ntsc',
    'https://ntsc.halbooking.dk/newlook/proc_baner.asp?soeg_omraede=5'
  )
  RETURNING id INTO nid;

  UPDATE public.matches SET court_id = nid WHERE court_id IS NOT NULL;
  UPDATE public.americano_tournaments SET court_id = nid WHERE court_id IS NOT NULL;

  DELETE FROM public.courts WHERE id <> nid;
END $$;

COMMIT;
