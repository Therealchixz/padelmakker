-- =============================================================================
-- Offentlige platform-tal til landing (anon + authenticated)
-- Kør i Supabase → SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.public_platform_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'player_count',
    (SELECT count(*)::int FROM public.profiles WHERE coalesce(is_banned, false) = false),
    'open_matches',
    (
      SELECT count(*)::int
      FROM public.matches
      WHERE status IN ('open', 'full', 'in_progress')
    ),
    'matches_last_30_days',
    (
      SELECT count(*)::int
      FROM public.matches
      WHERE status = 'completed'
        AND coalesce(date, created_at::date) >= (current_date - interval '30 days')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.public_platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_platform_stats() TO anon, authenticated;

COMMENT ON FUNCTION public.public_platform_stats() IS
  'Aggregate counts for marketing landing page (no PII).';
