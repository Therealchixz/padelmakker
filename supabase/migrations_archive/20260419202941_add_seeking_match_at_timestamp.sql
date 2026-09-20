-- Migration 20260419202941_add_seeking_match_at_timestamp
-- Backfilled from sql:recovered/add_seeking_match_at_timestamp.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seeking_match_at timestamptz;

COMMENT ON COLUMN public.profiles.seeking_match_at IS
  'Tidspunkt hvor brugeren aktiverede søger makker/kamp (TTL-baseret).';
