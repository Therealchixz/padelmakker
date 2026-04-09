-- =============================================================================
-- Americano: tilføj americano_draws på profiles (uafgjorte kampe spillet på banen)
-- Kør i Supabase SQL Editor hvis du allerede har kørt americano_profile_stats.sql
-- uden denne kolonne. Derefter kør igen hele americano_profile_stats.sql (eller
-- blot CREATE OR REPLACE FUNCTION recalc_americano_profile_stats) så tælleren
-- opdateres.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS americano_draws integer NOT NULL DEFAULT 0;
