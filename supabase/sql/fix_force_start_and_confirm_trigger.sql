-- =============================================================================
-- FIX: 1) "tving start" som admin/deltager fejler med RLS-violation på matches
--      2) "bekræft resultat" fejler med 'record "new" has no field "set1_tb1"'
-- =============================================================================
-- Kør i Supabase → SQL Editor → Run.  Idempotent.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) matches UPDATE: spejl USING i WITH CHECK
--    rls_policy_cleanup.sql efterlod WITH CHECK med kun (creator OR admin),
--    så deltagere ikke kunne sætte status til 'in_progress'.  Admin uden
--    gyldig PIN-session blev også blokeret, fordi is_admin() returnerer
--    false når der ikke er nogen verificeret PIN-session.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS matches_update_by_creator_or_participant ON public.matches;

CREATE POLICY matches_update_by_creator_or_participant
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = matches.id
        AND mp.user_id  = (SELECT auth.uid())
    )
    OR public.is_admin()
  )
  WITH CHECK (
    creator_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = matches.id
        AND mp.user_id  = (SELECT auth.uid())
    )
    OR public.is_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) guard_match_result_confirmation: tolerér manglende score-kolonner
--    Triggeren refererede NEW.set1_tb1 m.fl. direkte.  Hvis match_results
--    ikke har disse kolonner i den live database (kun frontend skriver dem
--    ved INSERT, og ingen migration tilføjer dem), fejler trigger med
--    "record 'new' has no field 'set1_tb1'".
--    Vi bruger to_jsonb(OLD/NEW) og itererer kun over felter der faktisk
--    findes i OLD-recorden.  Sikkerheden er bevaret: alle eksisterende
--    score-kolonner er stadig låst for ikke-admins.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_match_result_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_is_participant boolean := false;
  v_old_jsonb      jsonb;
  v_new_jsonb      jsonb;
  v_field          text;
  v_protected_fields constant text[] := ARRAY[
    'match_id','submitted_by',
    'team1_player1_id','team1_player2_id',
    'team2_player1_id','team2_player2_id',
    'set1_team1','set1_team2','set1_tb1','set1_tb2',
    'set2_team1','set2_team2','set2_tb1','set2_tb2',
    'set3_team1','set3_team2','set3_tb1','set3_tb2',
    'sets_won_team1','sets_won_team2',
    'match_winner','score_display'
  ];
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Tillad system-/SQL-kørsler (fx SECURITY DEFINER funktioner) uden klient-guard.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF OLD.confirmed IS TRUE THEN
    RAISE EXCEPTION 'Confirmed result is immutable';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.match_players mp
    WHERE mp.match_id = OLD.match_id
      AND mp.user_id = v_uid
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Only participants can confirm results';
  END IF;

  IF OLD.submitted_by = v_uid THEN
    RAISE EXCEPTION 'Submitter cannot self-confirm result';
  END IF;

  v_old_jsonb := to_jsonb(OLD);
  v_new_jsonb := to_jsonb(NEW);

  FOREACH v_field IN ARRAY v_protected_fields LOOP
    -- Spring felter over som ikke findes på tabellen (fx hvis _tb-kolonnerne
    -- aldrig blev tilføjet til match_results).
    IF NOT (v_old_jsonb ? v_field) THEN
      CONTINUE;
    END IF;

    IF (v_old_jsonb -> v_field) IS DISTINCT FROM (v_new_jsonb -> v_field) THEN
      RAISE EXCEPTION 'Only confirmation fields can be updated (changed: %)', v_field;
    END IF;
  END LOOP;

  IF NEW.confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'Result must be confirmed in this update';
  END IF;

  IF NEW.confirmed_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'confirmed_by must match current user';
  END IF;

  RETURN NEW;
END;
$$;

-- Triggeren peger allerede på funktionen; CREATE OR REPLACE er nok.
REVOKE ALL ON FUNCTION public.guard_match_result_confirmation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_match_result_confirmation() TO authenticated;


-- =============================================================================
-- VERIFICERING
-- =============================================================================
/*
-- 1) Tjek matches UPDATE-politik:
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'matches'
  AND cmd = 'UPDATE';

-- 2) Tjek at funktionen er opdateret:
SELECT pg_get_functiondef('public.guard_match_result_confirmation()'::regprocedure);
*/
