-- Fix: auto_confirm_expired_match_results fejlede hver cron-kørsel med
--   ERROR: record "v_result" has no field "score_text"
-- fordi match_results-kolonnen hedder score_display (ikke score_text).
-- Fejlen rullede hele transaktionen tilbage, så udløbne resultater aldrig
-- blev auto-bekræftet og ELO aldrig anvendt.
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
  v_notified_count integer := 0;
  v_elo_result jsonb;
  v_score_text text;
BEGIN
  FOR v_result IN
    SELECT *
    FROM match_results
    WHERE confirmed = false
      AND created_at < now() - interval '24 hours'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT mp.team INTO v_submitter_team
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id = v_result.submitted_by
    LIMIT 1;

    SELECT mp.user_id INTO v_opponent_id
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id <> v_result.submitted_by
      AND (v_submitter_team IS NULL OR mp.team <> v_submitter_team)
    LIMIT 1;

    IF v_opponent_id IS NULL THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE match_results
    SET confirmed = true,
        confirmed_by = v_opponent_id
    WHERE id = v_result.id;

    v_confirmed_count := v_confirmed_count + 1;

    v_elo_result := public.apply_elo_for_match_system(v_result.id);
    IF (v_elo_result->>'success')::boolean IS TRUE THEN
      v_elo_applied_count := v_elo_applied_count + 1;
      PERFORM public.notify_elo_changes_for_match(v_result.match_id);
    END IF;

    v_score_text := coalesce(nullif(trim(v_result.score_display), ''), 'Resultat');

    v_notified_count := v_notified_count + coalesce(
      public.notify_auto_confirmed_match_result(v_result.match_id, v_score_text),
      0
    );
  END LOOP;

  RETURN jsonb_build_object(
    'confirmed', v_confirmed_count,
    'elo_applied', v_elo_applied_count,
    'notified', v_notified_count,
    'skipped', v_skipped_count,
    'ran_at', now()
  );
END;
$function$;
