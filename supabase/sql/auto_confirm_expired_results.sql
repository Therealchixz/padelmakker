-- =============================================================================
-- Auto-confirm match results that have been pending for more than 24 hours.
--
-- Flow per result:
--   1. Find an opponent player (different team from submitted_by).
--   2. Set confirmed = true, confirmed_by = <opponent player>.
--   3. Apply ELO via the system-internal variant (no auth context needed).
--
-- Schedule: run every 30 minutes via pg_cron.
--
-- Requires pg_cron extension: run once as superuser:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- IMPORTANT: The system ELO function `apply_elo_for_match_system(uuid)` is
-- defined as a thin wrapper around `apply_elo_for_match_core` in
-- `elo_v2_glicko2_shadow.sql`. Apply that migration before (or after) this
-- one — do NOT re-introduce a local copy here, since `CREATE OR REPLACE
-- FUNCTION` would silently revert the ELO algorithm.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- auto_confirm_expired_match_results
-- Finds unconfirmed results older than 24 hours and auto-confirms them.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_expired_match_results()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_result match_results%ROWTYPE;
  v_submitter_team integer;
  v_opponent_id uuid;
  v_confirmed_count integer := 0;
  v_elo_applied_count integer := 0;
  v_skipped_count integer := 0;
  v_elo_result jsonb;
BEGIN
  FOR v_result IN
    SELECT *
    FROM match_results
    WHERE confirmed = false
      AND created_at < now() - interval '24 hours'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Find the submitter's team
    SELECT mp.team INTO v_submitter_team
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id = v_result.submitted_by
    LIMIT 1;

    -- Find an opponent player (different team, not the submitter themselves)
    SELECT mp.user_id INTO v_opponent_id
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id <> v_result.submitted_by
      AND (v_submitter_team IS NULL OR mp.team <> v_submitter_team)
    LIMIT 1;

    IF v_opponent_id IS NULL THEN
      -- Cannot find a valid confirmer; skip (corrupt or single-team match).
      -- Surface in pg logs so admins can investigate; the result row remains
      -- unconfirmed and will be retried next run (or surfaces in the admin UI).
      RAISE WARNING 'auto_confirm_expired_match_results: skip result_id=% match_id=% submitted_by=% (no opponent found)',
        v_result.id, v_result.match_id, v_result.submitted_by;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Auto-confirm the result with the opponent as confirmer
    UPDATE match_results
    SET confirmed = true,
        confirmed_by = v_opponent_id
    WHERE id = v_result.id;

    v_confirmed_count := v_confirmed_count + 1;

    -- Apply ELO without an auth context
    v_elo_result := public.apply_elo_for_match_system(v_result.id);
    IF (v_elo_result->>'success')::boolean IS TRUE THEN
      v_elo_applied_count := v_elo_applied_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'confirmed', v_confirmed_count,
    'elo_applied', v_elo_applied_count,
    'skipped', v_skipped_count,
    'ran_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_confirm_expired_match_results() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_confirm_expired_match_results() TO service_role;

-- -----------------------------------------------------------------------------
-- pg_cron schedule — runs every 30 minutes.
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_cron; (run as superuser once)
-- In Supabase: enable via Dashboard → Database → Extensions → pg_cron
-- -----------------------------------------------------------------------------
SELECT cron.unschedule('auto-confirm-expired-results')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-expired-results'
  );

SELECT cron.schedule(
  'auto-confirm-expired-results',
  '*/30 * * * *',
  'SELECT public.auto_confirm_expired_match_results()'
);
