-- Valgfrit: direkte booking-URL pr. bane (Baner-fanen viser knap "Se ledige tider og book").
-- booking_provider: stabilt flag uafhængigt af navn (fx Skansen uden "ntsc" i teksten).
--   Sæt til 'halbooking_ntsc' for samme portal som NTSC/Skansen Padel.

ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS booking_url text;

ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS booking_provider text;

COMMENT ON COLUMN public.courts.booking_url IS 'Ekstern booking-URL (åbnes i ny fane), fx Halbooking.';
COMMENT ON COLUMN public.courts.booking_provider IS 'Valgfrit: halbooking_ntsc = åbn NTSC Halbooking; ellers bruger appen navn/adresse-match.';
