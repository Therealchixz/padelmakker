-- Migration 20260417102106_league_teams_invitation_status
-- Backfilled from sql:recovered/league_teams_invitation_status.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Holdinvitationer: pending / ready.

ALTER TABLE public.league_teams
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.league_teams
  DROP CONSTRAINT IF EXISTS league_teams_status_check;

ALTER TABLE public.league_teams
  ADD CONSTRAINT league_teams_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'ready'::text]));

COMMENT ON COLUMN public.league_teams.status IS
  'pending = afventer partner; ready = begge spillere accepteret.';
