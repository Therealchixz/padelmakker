-- Tilføjer ugeskema-baseret tilgængelighed til spillerprofiler.
-- available_days er et text[]-array med ISO-ugedag-nøgler:
-- 'mon','tue','wed','thu','fri','sat','sun'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_days text[] DEFAULT '{}';
