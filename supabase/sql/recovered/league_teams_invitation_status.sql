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
