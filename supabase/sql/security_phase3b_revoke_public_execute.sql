-- =============================================================================
-- Phase 3b: REVOKE EXECUTE FROM PUBLIC på SECURITY DEFINER RPC'er
-- (anon arver ellers adgang via =X/postgres selv efter REVOKE FROM anon)
-- Bevarer public_platform_stats + public_upcoming_americano_events.
-- =============================================================================

DO $$
DECLARE
  r record;
  v_keep text[] := ARRAY[
    'public_platform_stats',
    'public_upcoming_americano_events'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND p.proname <> ALL (v_keep)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
