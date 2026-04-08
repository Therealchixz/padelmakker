-- =============================================================================
-- profiles: sørg for at "region" fra appen lander i samme felt som UI forventer
-- =============================================================================
-- Problem: Appen bruger kolonnen `area` (Region Hovedstaden osv.). Hvis tabellen
-- kun har `city` (vises som "By" i dashboard), bliver region ikke gemt korrekt.
--
-- Kør i Supabase → SQL Editor (én gang).
-- =============================================================================

-- 1) Omdøb city → area hvis kun city findes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'area'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN city TO area;
    RAISE NOTICE 'Omdøbte profiles.city → profiles.area';
  END IF;
END $$;

-- 2) Hvis BÅDE city og area findes: kopier til area hvor area er tom
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'area'
  ) THEN
    UPDATE public.profiles
    SET area = city
    WHERE (area IS NULL OR trim(area) = '')
      AND city IS NOT NULL
      AND trim(both from city::text) <> '';
    RAISE NOTICE 'Kopierede profiles.city → area hvor area var tom';
  END IF;
END $$;

-- 3) Valgfrit: fjern forældede city hvis den stadig findes ved siden af area
-- (kommentér ind hvis du vil droppe kolonnen efter tjek)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS city;
