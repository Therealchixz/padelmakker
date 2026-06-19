-- Division pr. hold i en liga (til divisionsligaer). Default 1 = enkelt pulje.
-- Anvendt på remote DB 2026-06-15.
ALTER TABLE public.league_teams
  ADD COLUMN IF NOT EXISTS division int NOT NULL DEFAULT 1;
