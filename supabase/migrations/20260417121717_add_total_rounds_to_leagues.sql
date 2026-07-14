-- Migration 20260417121717_add_total_rounds_to_leagues
-- Backfilled from sql:recovered/add_total_rounds_to_leagues.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS total_rounds integer;

COMMENT ON COLUMN public.leagues.total_rounds IS
  'Planlagt antal runder for round-robin / turnering.';
