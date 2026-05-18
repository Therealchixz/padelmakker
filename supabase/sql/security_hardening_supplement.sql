-- =============================================================================
-- Supplement efter security_hardening_phase2 (valgfri oprydning + ekstra revoke)
-- Kør i Supabase SQL Editor hvis grants stadig viser authenticated.
-- =============================================================================

-- Ekstra revoke på farlige RPC'er
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_elo_for_match_core',
        'recalc_americano_elo_from_history',
        'recalc_profile_stats_from_elo_history',
        'recalc_americano_profile_stats',
        'create_rating_admin_flag'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END
$$;

-- Fjern dublet-policies på messages (behold engelske navne fra hardening)
DROP POLICY IF EXISTS "Brugere kan se egne beskeder" ON public.messages;
DROP POLICY IF EXISTS "Brugere kan sende beskeder" ON public.messages;
DROP POLICY IF EXISTS messages_update_read ON public.messages;

NOTIFY pgrst, 'reload schema';
