-- =============================================================================
-- profiles: sikr kolonner til profilredigering (fødselsår, tilgængelighed)
-- =============================================================================
-- Kør i Supabase → SQL Editor hvis "Gem ændringer" fejler eller felter ikke
-- opdateres (manglende kolonner).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'birth_year'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN birth_year integer;
    RAISE NOTICE 'Tilføjet profiles.birth_year';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'availability'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN availability text[] DEFAULT '{}';
    RAISE NOTICE 'Tilføjet profiles.availability (text[])';
  END IF;
END $$;
