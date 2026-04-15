-- Matchmaking v1: nye profilfelter
-- Kør i Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS latitude          float,
  ADD COLUMN IF NOT EXISTS longitude         float,
  ADD COLUMN IF NOT EXISTS travel_willing    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intent_now        text,
  ADD COLUMN IF NOT EXISTS seeking_match     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at    timestamptz;

-- Index til hurtig filtrering på aktive + søgende spillere
CREATE INDEX IF NOT EXISTS idx_profiles_seeking_match
  ON profiles (seeking_match)
  WHERE seeking_match = true AND is_banned = false;

CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON profiles (last_active_at DESC NULLS LAST);

-- Sæt last_active_at til created_at for eksisterende spillere så de
-- ikke alle bliver filtreret fra ved første deploy
UPDATE profiles
SET last_active_at = created_at
WHERE last_active_at IS NULL AND created_at IS NOT NULL;
