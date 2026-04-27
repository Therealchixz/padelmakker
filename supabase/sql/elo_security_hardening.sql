-- =============================================================================
-- ELO SECURITY HARDENING (RLS + trigger guards + constraints)
-- Kør i Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) match_results: ingen submitter-self-confirm, kun modspiller/admin
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS match_results_update_by_participant ON public.match_results;
CREATE POLICY match_results_update_by_participant
  ON public.match_results
  FOR UPDATE TO authenticated
  USING (
    (
      confirmed IS NOT TRUE
      AND submitted_by <> (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.match_players mp
        WHERE mp.match_id = match_results.match_id
          AND mp.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_admin()
  )
  WITH CHECK (
    (
      confirmed IS TRUE
      AND confirmed_by = (SELECT auth.uid())
      AND submitted_by <> (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.match_players mp
        WHERE mp.match_id = match_results.match_id
          AND mp.user_id = (SELECT auth.uid())
      )
    )
    OR public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- 2) match_results: håndhæv one-result-per-match
--    Vi beholder den "bedste" række pr. match (confirmed først, ellers nyeste).
-- -----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    match_id,
    ROW_NUMBER() OVER (
      PARTITION BY match_id
      ORDER BY
        CASE WHEN confirmed THEN 1 ELSE 0 END DESC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.match_results
)
DELETE FROM public.match_results mr
USING ranked r
WHERE mr.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_match_results_match_id
  ON public.match_results (match_id);

-- -----------------------------------------------------------------------------
-- 3) Guard trigger: non-admin må kun bekræfte, ikke omskrive scorefelter
-- -----------------------------------------------------------------------------
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

  -- Vi sammenligner via jsonb så manglende kolonner (fx _tb hvis de aldrig
  -- blev tilføjet til den live tabel) ikke giver "record has no field"-fejl.
  v_old_jsonb := to_jsonb(OLD);
  v_new_jsonb := to_jsonb(NEW);

  FOREACH v_field IN ARRAY v_protected_fields LOOP
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

DROP TRIGGER IF EXISTS trg_guard_match_result_confirmation ON public.match_results;
CREATE TRIGGER trg_guard_match_result_confirmation
BEFORE UPDATE ON public.match_results
FOR EACH ROW
EXECUTE FUNCTION public.guard_match_result_confirmation();

REVOKE ALL ON FUNCTION public.guard_match_result_confirmation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_match_result_confirmation() TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) protect_elo_fields: gør ELO/admin-felter immutable via klient-UPDATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_elo_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Tillad system-/SQL-kørsler (fx SECURITY DEFINER funktioner).
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF
    NEW.elo_rating IS DISTINCT FROM OLD.elo_rating
    OR NEW.games_played IS DISTINCT FROM OLD.games_played
    OR NEW.games_won IS DISTINCT FROM OLD.games_won
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
  THEN
    RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_elo_fields ON public.profiles;
CREATE TRIGGER protect_elo_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_elo_fields();

REVOKE ALL ON FUNCTION public.protect_elo_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_elo_fields() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) apply_elo_for_match: eksplicit execute rettigheder
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.apply_elo_for_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_elo_for_match(uuid) TO authenticated;
