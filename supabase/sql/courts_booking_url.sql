-- Valgfrit: direkte booking-URL pr. bane (Baner-fanen viser knap "Se ledige tider og book").
-- Hvis tom, bruges stadig navn-match (fx "NTSC" → Halbooking) i appen.

ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS booking_url text;

COMMENT ON COLUMN public.courts.booking_url IS 'Ekstern booking-URL (åbnes i ny fane), fx Halbooking.';
