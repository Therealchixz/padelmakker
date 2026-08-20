-- PII lockdown: revoke API SELECT on profiles.email + match_players.user_email.
-- Admins read emails via admin_profiles_with_email() (SECURITY DEFINER).
-- Clients must use PROFILE_SAFE_SELECT / MATCH_PLAYERS_SAFE_SELECT (no *).

-- 1) match_players: authenticated-only SELECT (idempotent)
DROP POLICY IF EXISTS "Alle kan se match_players" ON public.match_players;
DROP POLICY IF EXISTS "Match players viewable" ON public.match_players;
DROP POLICY IF EXISTS match_players_select_authenticated ON public.match_players;

CREATE POLICY match_players_select_authenticated
  ON public.match_players
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) match_players.user_email: not exposed via API
REVOKE SELECT (user_email) ON public.match_players FROM PUBLIC;
REVOKE SELECT (user_email) ON public.match_players FROM anon;
REVOKE SELECT (user_email) ON public.match_players FROM authenticated;

-- 3) profiles.email: not exposed via API
REVOKE SELECT (email) ON public.profiles FROM PUBLIC;
REVOKE SELECT (email) ON public.profiles FROM anon;
REVOKE SELECT (email) ON public.profiles FROM authenticated;

-- 4) Admins: SECURITY DEFINER helper for admin UI (email list)
CREATE OR REPLACE FUNCTION public.admin_profiles_with_email()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_profiles_with_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_profiles_with_email() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_profiles_with_email() TO authenticated;

NOTIFY pgrst, 'reload schema';
