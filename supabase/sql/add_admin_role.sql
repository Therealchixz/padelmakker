-- =============================================================================
-- Admin Role & Sikkerhed (RLS)
-- =============================================================================

-- 1. Tilføj 'role' kolonne hvis den ikke findes
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'player';

-- 2. Opret helper funktion til at tjekke admin-status (undgår rekursion i RLS)
-- Fuld logik (PIN + JWT-alder): admin_security_phase3_deploy.sql
CREATE OR REPLACE FUNCTION public.has_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pin_verified boolean := false;
  v_iat bigint;
  v_max_admin_jwt_seconds constant integer := 8 * 3600;
BEGIN
  IF v_uid IS NULL OR NOT public.has_admin_role() THEN
    RETURN false;
  END IF;

  v_iat := NULLIF(auth.jwt() ->> 'iat', '')::bigint;
  IF v_iat IS NULL OR (extract(epoch FROM now())::bigint - v_iat) > v_max_admin_jwt_seconds THEN
    RETURN false;
  END IF;

  IF to_regclass('public.admin_pin_sessions') IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_pin_sessions s
    WHERE s.user_id = v_uid AND s.verified_until > now()
  ) INTO v_pin_verified;

  RETURN COALESCE(v_pin_verified, false);
END;
$$;

-- Fjern offentlig adgang til funktionen
REVOKE ALL ON FUNCTION public.has_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. Opdater RLS policies for 'profiles'
-- Admins skal kunne se og opdatere alle profiler
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Opdater RLS for 'matches' og 'match_results'
-- Admins skal kunne slette/rette kampe
DROP POLICY IF EXISTS matches_admin_all ON public.matches;
CREATE POLICY matches_admin_all ON public.matches
  FOR ALL TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS match_results_admin_all ON public.match_results;
CREATE POLICY match_results_admin_all ON public.match_results
  FOR ALL TO authenticated
  USING (public.is_admin());

-- 5. Opdater RLS for 'elo_history'
DROP POLICY IF EXISTS elo_history_admin_all ON public.elo_history;
CREATE POLICY elo_history_admin_all ON public.elo_history
  FOR ALL TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- SÅDAN GØR DU DIG SELV TIL ADMIN:
-- Erstat 'DIT_NAVN_HER' med dit navn (eller brug din e-mail/ID)
-- =============================================================================
/*
UPDATE public.profiles 
SET role = 'admin' 
WHERE name = 'DIT_NAVN_HER' OR full_name = 'DIT_NAVN_HER';
*/
