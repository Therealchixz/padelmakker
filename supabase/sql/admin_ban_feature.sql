-- =============================================================================
-- ADMIN BAN FEATURE
-- =============================================================================

-- 1. Tilføj 'is_banned' kolonne til profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- 2. Opdater RLS-policies til at blokere bannere brugere
-- Vi tilføjer et tjek på alle skrivnings-operationer (INSERT/UPDATE/DELETE)

-- Funktion til at tjekke om en bruger er bannet
CREATE OR REPLACE FUNCTION public.is_banned()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_banned = true
  );
END;
$$;

-- Opdater eksisterende policies på de vigtigste tabeller
-- (Dette er et eksempel, vi sikrer at policies nu også tjekker NOT is_banned())

-- For profiles: Kun ikke-bannere brugere må opdatere sig selv
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND NOT public.is_banned());

-- For matches: Kun ikke-bannere brugere må oprette/rette
DROP POLICY IF EXISTS "Matches insertable" ON public.matches;
CREATE POLICY "Matches insertable" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_banned());

-- Bemærk: Admins politikker (profiles_admin_all osv.) skal stadig gælde 
-- da de bruger is_admin(), som vi har defineret separat.
