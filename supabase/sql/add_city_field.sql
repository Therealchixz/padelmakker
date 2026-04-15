-- Tilføj by-felt til profiler
-- Kør i Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS city text;
