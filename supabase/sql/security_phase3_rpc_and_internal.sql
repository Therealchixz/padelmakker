-- =============================================================================
-- Phase 3: Luk interne RPC'er + fjern anon-adgang til følsomme funktioner
-- Bevarer bevidst offentlige RPC'er til forsiden.
-- Kør i Supabase SQL Editor (idempotent).
-- =============================================================================

-- Intern rate-limit helper: kun kaldes fra andre SECURITY DEFINER RPC'er
DO $$
BEGIN
  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public._rpc_rate_limit_or_raise(text, integer, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public._rpc_rate_limit_or_raise(text, integer, integer) FROM anon;
    REVOKE ALL ON FUNCTION public._rpc_rate_limit_or_raise(text, integer, integer) FROM authenticated;
  END IF;

  IF to_regprocedure('public.check_rate_limit(text,bigint,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.check_rate_limit(text, bigint, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.check_rate_limit(text, bigint, integer) FROM anon;
    REVOKE ALL ON FUNCTION public.check_rate_limit(text, bigint, integer) FROM authenticated;
  END IF;
END $$;

-- Fjern anon EXECUTE på alle SECURITY DEFINER RPC'er undtagen offentlige landing-RPC'er
DO $$
DECLARE
  r record;
  v_keep text[] := ARRAY[
    'public_platform_stats',
    'public_upcoming_americano_events'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND p.proname <> ALL (v_keep)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- ELO-wrapper: kræv login (core er allerede service_role-only)
DO $$
BEGIN
  IF to_regprocedure('public.apply_elo_for_match(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.apply_elo_for_match(uuid) FROM anon;
    GRANT EXECUTE ON FUNCTION public.apply_elo_for_match(uuid) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
