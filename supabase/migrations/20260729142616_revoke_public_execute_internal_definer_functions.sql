-- Hardening (opfølgning): 6 interne SECURITY DEFINER-funktioner havde stadig
-- EXECUTE via PUBLIC-grant (revoke fra anon alene hjælper ikke når PUBLIC har
-- grant). De kaldes kun fra andre definer-funktioner/triggers (owner-context)
-- og aldrig direkte fra klienten — verificeret ved kode-søgning.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        '_insert_system_notification','_skip_duplicate_match_notification',
        'guard_americano_participant_insert','league_team_messages_set_league_id',
        'notify_auto_confirmed_match_result','notify_elo_changes_for_match'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
