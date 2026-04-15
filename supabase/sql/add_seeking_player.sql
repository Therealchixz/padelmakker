-- Mangler 1 spiller feature
-- Kør i Supabase SQL editor

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS seeking_player           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seeking_player_notified_at timestamptz;

-- Index til at hente åbne kampe der søger spillere
CREATE INDEX IF NOT EXISTS idx_matches_seeking_player
  ON matches (seeking_player)
  WHERE seeking_player = true;
