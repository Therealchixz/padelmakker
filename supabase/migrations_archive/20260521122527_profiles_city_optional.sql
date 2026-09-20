-- Migration 20260521122527_profiles_city_optional
-- Backfilled from migration:20260529120000_profiles_city_optional.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Valgfri by på profil (region forbliver i area)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text;

COMMENT ON COLUMN public.profiles.city IS 'Valgfri by inden for profiles.area (region).';
