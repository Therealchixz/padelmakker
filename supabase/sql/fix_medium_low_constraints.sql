-- =============================================================================
-- Medium/low-prioriterede constraints (oprettet som fix efter review)
-- Kør i Supabase → SQL Editor. Alle statements er idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) time_slot: HH:MM-format constraint
--    Forhindrer værdier som "9:00", "18:00:00", "i morgen aftes" der bryder
--    den leksikografiske sortering i public_upcoming_americano_events.
-- -----------------------------------------------------------------------------
ALTER TABLE public.americano_tournaments
  DROP CONSTRAINT IF EXISTS americano_tournaments_time_slot_format;

ALTER TABLE public.americano_tournaments
  ADD CONSTRAINT americano_tournaments_time_slot_format
  CHECK (time_slot ~ '^\d{2}:\d{2}$');

-- -----------------------------------------------------------------------------
-- 2) birth_year: sanity-check range
--    Forhindrer årstal som 0, -1, 99999 i profiles.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_birth_year_range;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_year_range
  CHECK (birth_year IS NULL OR (birth_year BETWEEN 1920 AND 2015));

-- -----------------------------------------------------------------------------
-- 3) notifications.match_id: FK med ON DELETE SET NULL
--    Sikrer at notification-rækker ikke hænger med ugyldigt match_id
--    når en kamp slettes (i stedet for orphaned UUID).
--    Kræver at public.matches eksisterer — kommenter ud hvis ikke.
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_match_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES public.matches (id) ON DELETE SET NULL;
