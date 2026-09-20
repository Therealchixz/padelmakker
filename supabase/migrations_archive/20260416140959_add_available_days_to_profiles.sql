-- Migration 20260416140959_add_available_days_to_profiles
-- Backfilled from sql:add_available_days_to_profiles.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Tilføjer ugeskema-baseret tilgængelighed til spillerprofiler.
-- available_days er et text[]-array med ISO-ugedag-nøgler:
-- 'mon','tue','wed','thu','fri','sat','sun'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_days text[] DEFAULT '{}';
