
        UNION

        SELECT match_id AS m
        FROM public.match_players
        WHERE user_id = $1
          AND match_id IS NOT NULL
      ) s
    $SQL$
    INTO v_mids
    USING p_user_id;
  END IF;

  IF v_mids IS NOT NULL AND cardinality(v_mids) > 0 THEN
    IF to_regclass('public.match_results') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.match_results WHERE match_id = ANY ($1)'
      USING v_mids;
    END IF;

    EXECUTE 'DELETE FROM public.match_players WHERE match_id = ANY ($1)'
    USING v_mids;

    EXECUTE 'DELETE FROM public.matches WHERE id = ANY ($1)'
    USING v_mids;

    v_deleted_matches := cardinality(v_mids);
  END IF;

  -- Øvrige spillerknyttede tabeller (hvis de findes)
  IF to_regclass('public.elo_history') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.elo_history WHERE user_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.messages WHERE sender_id = $1 OR receiver_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.user_blocks') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_blocks WHERE blocker_id = $1 OR blocked_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.user_reports') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.user_reports WHERE reporter_id = $1 OR reported_id = $1 OR resolved_by = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.push_subscriptions WHERE user_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.americano_tournaments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.americano_tournaments WHERE creator_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.americano_participants') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.americano_participants WHERE user_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.league_participants') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.league_participants WHERE user_id = $1'
    USING p_user_id;
  END IF;

  IF to_regclass('public.leagues') IS NOT NULL THEN
    EXECUTE 'UPDATE public.leagues SET created_by = NULL WHERE created_by = $1'
    USING p_user_id;
  END IF;

  DELETE FROM public.profiles
  WHERE id = p_user_id;

  DELETE FROM auth.users
  WHERE id = p_user_id;

  PERFORM public._admin_audit_log(
    'delete_user',
    p_user_id,
    jsonb_build_object('deleted_email', v_target_email, 'deleted_matches', v_deleted_matches)
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user_id', p_user_id,
    'deleted_email', v_target_email,
    'deleted_matches', v_deleted_matches
  );
END;
$$;

-- Del af admin_security_phase3 — RPC-hårdning og audit (inkluderes i fuld migration)

-- ─── protect_elo_fields: phone_verification_exempt ────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_elo_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

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
    OR NEW.americano_elo_rating IS DISTINCT FROM OLD.americano_elo_rating
    OR NEW.americano_played IS DISTINCT FROM OLD.americano_played
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
    OR (
      to_jsonb(NEW) ? 'phone_verification_exempt'
      AND NEW.phone_verification_exempt IS DISTINCT FROM OLD.phone_verification_exempt
    )
  THEN
    RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Resultat-bekræftelse: admin skal have PIN ────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_valid_match_result_confirmation(
  p_match_id uuid,
  p_submitted_by uuid,
  p_confirmed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $confirm_guard$
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_user_admin_verified(p_confirmed_by) THEN
    RETURN true;
  END IF;

  RETURN public.can_confirm_match_result(p_match_id, p_submitted_by, p_confirmed_by);
END;
$confirm_guard$;

-- ─── admin_set_phone_verification_exempt ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_phone_verification_exempt(
  p_user_id uuid,
  p_exempt boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Kun admin med verificeret PIN kan ændre telefon-undtagelse');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler user_id');
  END IF;

  UPDATE public.profiles
  SET phone_verification_exempt = COALESCE(p_exempt, false)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profil findes ikke');
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('phone_verification_exempt', COALESCE(p_exempt, false))
  WHERE id = p_user_id;

  PERFORM public._admin_audit_log(
    'phone_verification_exempt',
    p_user_id,
    jsonb_build_object('exempt', COALESCE(p_exempt, false))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'phone_verification_exempt', COALESCE(p_exempt, false)
  );
END;
$$;

-- ─── admin_restore_deleted_profile ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_restore_deleted_profile(
  p_archive_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_archive public.deleted_players_archive%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Kun admin med verificeret PIN kan restore profiler');
  END IF;

  IF p_archive_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler archive_id eller target_user_id');
  END IF;

  SELECT *
    INTO v_archive
  FROM public.deleted_players_archive
  WHERE id = p_archive_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Archive entry ikke fundet');
  END IF;

  IF v_archive.restored_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Denne archive entry er allerede restored');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RETURN jsonb_build_object('error', 'target_user_id findes ikke i auth.users');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_target_user_id) THEN
    RETURN jsonb_build_object('error', 'Der findes allerede en profil for target_user_id');
  END IF;

  INSERT INTO public.profiles
  SELECT (jsonb_populate_record(
    null::public.profiles,
    jsonb_set(v_archive.profile_snapshot, '{id}', to_jsonb(p_target_user_id), true)
  )).*;

  UPDATE public.deleted_players_archive
  SET restored_at = now(),
      restored_by = v_actor_id,
      restored_user_id = p_target_user_id
  WHERE id = p_archive_id;

  PERFORM public._admin_audit_log(
    'restore_deleted_profile',
    p_target_user_id,
    jsonb_build_object('archive_id', p_archive_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'archive_id', p_archive_id,
    'restored_user_id', p_target_user_id
  );
END;
$$;

-- ─── admin_adjust_elo + audit ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_elo int;
  v_first_id uuid;
  v_first_old numeric;
  v_diff numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Adgang nægtet: Kun admins kan justere ELO manuelt.';
  END IF;

  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;

  SELECT id, old_rating INTO v_first_id, v_first_old
  FROM public.elo_history
  WHERE user_id = p_user_id
    AND old_rating IS NOT NULL
    AND match_id IS NOT NULL
  ORDER BY date ASC, match_id ASC, id ASC
  LIMIT 1;

  IF v_first_id IS NOT NULL THEN
    v_diff := p_new_elo - v_current_elo;

    UPDATE public.elo_history
    SET old_rating = old_rating + v_diff
    WHERE id = v_first_id;
  ELSE
    UPDATE public.profiles
    SET elo_rating = p_new_elo
    WHERE id = p_user_id;
  END IF;

  PERFORM public._admin_audit_log(
    'adjust_elo',
    p_user_id,
    jsonb_build_object('new_elo', p_new_elo, 'previous_elo', v_current_elo)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.admin_correct_match_result_and_recalc_elo(
  p_match_result_id uuid,
  p_result jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_mr public.match_results%ROWTYPE;
  v_match_id uuid;
  v_player_id uuid;
  v_winner text;
  v_score_display text;
  v_elo jsonb;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun admin kan rette kampresultater');
  END IF;
  IF p_match_result_id IS NULL OR p_result IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende data');
  END IF;

  v_winner := nullif(trim(p_result->>'match_winner'), '');
  IF v_winner NOT IN ('team1', 'team2') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig vinder (team1 eller team2)');
  END IF;

  v_score_display := nullif(trim(p_result->>'score_display'), '');
  IF v_score_display IS NULL OR length(v_score_display) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende score_display');
  END IF;

  SELECT * INTO v_mr
  FROM public.match_results
  WHERE id = p_match_result_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Resultat ikke fundet');
  END IF;

  IF v_mr.confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun bekræftede resultater kan rettes her');
  END IF;

  v_match_id := v_mr.match_id;

  -- Fjern tidligere ELO for kampen
  DELETE FROM public.elo_history WHERE match_id = v_match_id;

  IF to_regclass('public.glicko2_shadow_history') IS NOT NULL THEN
    DELETE FROM public.glicko2_shadow_history WHERE match_id = v_match_id;
  END IF;

  FOR v_player_id IN
    SELECT mp.user_id
    FROM public.match_players mp
    WHERE mp.match_id = v_match_id
  LOOP
    PERFORM public.recalc_profile_stats_from_elo_history(v_player_id);
  END LOOP;

  UPDATE public.matches
  SET status = 'in_progress', completed_at = NULL
  WHERE id = v_match_id;

  UPDATE public.match_results
  SET
    set1_team1 = nullif(p_result->>'set1_team1', '')::int,
    set1_team2 = nullif(p_result->>'set1_team2', '')::int,
    set1_tb1 = nullif(p_result->>'set1_tb1', '')::int,
    set1_tb2 = nullif(p_result->>'set1_tb2', '')::int,
    set2_team1 = nullif(p_result->>'set2_team1', '')::int,
    set2_team2 = nullif(p_result->>'set2_team2', '')::int,
    set2_tb1 = nullif(p_result->>'set2_tb1', '')::int,
    set2_tb2 = nullif(p_result->>'set2_tb2', '')::int,
    set3_team1 = nullif(p_result->>'set3_team1', '')::int,
    set3_team2 = nullif(p_result->>'set3_team2', '')::int,
    set3_tb1 = nullif(p_result->>'set3_tb1', '')::int,
    set3_tb2 = nullif(p_result->>'set3_tb2', '')::int,
    sets_won_team1 = nullif(p_result->>'sets_won_team1', '')::int,
    sets_won_team2 = nullif(p_result->>'sets_won_team2', '')::int,
    match_winner = v_winner,
    score_display = v_score_display,
    confirmed = true
  WHERE id = p_match_result_id;

  v_elo := public.apply_elo_for_match_core(p_match_result_id, v_admin, true);

  IF COALESCE(v_elo->>'success', 'false')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_elo->>'error', 'ELO kunne ikke genberegnes')
      USING DETAIL = coalesce(v_elo::text, '');
  END IF;

  PERFORM public._admin_audit_log(
    'correct_match_result',
    NULL,
    jsonb_build_object('match_result_id', p_match_result_id, 'match_id', v_match_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', v_match_id,
    'score_display', v_score_display,
    'elo', v_elo
  );

CREATE OR REPLACE FUNCTION public.recalc_americano_elo_from_history(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_base_rating numeric;
  v_total_delta numeric;
  v_played int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT h.old_rating::numeric
    INTO v_base_rating
  FROM public.americano_elo_history h
  WHERE h.user_id = p_user_id
  ORDER BY h.created_at ASC, h.tournament_id ASC, h.id ASC
  LIMIT 1;

  IF v_base_rating IS NULL THEN
    UPDATE public.profiles
    SET
      americano_elo_rating = 1000,
      americano_played = 0
    WHERE id = p_user_id;
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(h.change::numeric), 0),
    COUNT(*)::int
  INTO v_total_delta, v_played
  FROM public.americano_elo_history h
  WHERE h.user_id = p_user_id;

  UPDATE public.profiles
  SET
    americano_elo_rating = GREATEST(100, ROUND(v_base_rating + v_total_delta)::int),
    americano_played = COALESCE(v_played, 0)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_americano_elo_from_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_americano_elo_from_history(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recalc_americano_elo_from_history(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_correct_americano_tournament(
  p_tournament_id uuid,
  p_matches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_points_per_match integer;
  v_status text;
  v_row jsonb;
  v_match_id uuid;
  v_a int;
  v_b int;
  v_user_id uuid;
  v_apply jsonb;
  v_expected int;
  v_updated int := 0;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun admin kan rette Americano-resultater');
  END IF;
  IF p_tournament_id IS NULL OR p_matches IS NULL OR jsonb_typeof(p_matches) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende eller ugyldige kampdata');
  END IF;

  SELECT t.status, t.points_per_match
    INTO v_status, v_points_per_match
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turnering ikke fundet');
  END IF;

  IF v_status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede turneringer kan rettes her');
  END IF;

  IF COALESCE(v_points_per_match, 0) NOT IN (16, 24, 32) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldigt pointformat på turneringen');
  END IF;

  SELECT COUNT(*)::int
    INTO v_expected
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id;

  IF v_expected = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Turneringen har ingen kampe');
  END IF;

  IF jsonb_array_length(p_matches) <> v_expected THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      format('Alle %s kampe skal medsendes (%s modtaget)', v_expected, jsonb_array_length(p_matches))
    );
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    v_match_id := nullif(v_row->>'id', '')::uuid;
    IF v_match_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Hver kamp skal have et id');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.americano_matches m
      WHERE m.id = v_match_id AND m.tournament_id = p_tournament_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kamp tilhører ikke denne turnering');
    END IF;

    v_a := (v_row->>'team_a_score')::int;
    v_b := (v_row->>'team_b_score')::int;

    IF v_a IS NULL OR v_b IS NULL OR v_a < 0 OR v_b < 0 OR (v_a + v_b) <> v_points_per_match THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        format('Ugyldig score for kamp %s (summen skal være %s)', v_match_id, v_points_per_match)
      );
    END IF;
  END LOOP;

  DELETE FROM public.americano_elo_history
  WHERE tournament_id = p_tournament_id;

  FOR v_user_id IN
    SELECT DISTINCT ap.user_id
    FROM public.americano_participants ap
    WHERE ap.tournament_id = p_tournament_id
  LOOP
    PERFORM public.recalc_americano_elo_from_history(v_user_id);
  END LOOP;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_matches)
  LOOP
    v_match_id := (v_row->>'id')::uuid;
    v_a := (v_row->>'team_a_score')::int;
    v_b := (v_row->>'team_b_score')::int;

    UPDATE public.americano_matches
    SET
      team_a_score = v_a,
      team_b_score = v_b,
      results_locked = true,
      updated_at = now()
    WHERE id = v_match_id
      AND tournament_id = p_tournament_id;

    v_updated := v_updated + 1;
  END LOOP;

  FOR v_user_id IN
    SELECT DISTINCT ap.user_id
    FROM public.americano_participants ap
    WHERE ap.tournament_id = p_tournament_id
  LOOP
    PERFORM public.recalc_americano_profile_stats(v_user_id);
  END LOOP;

  v_apply := public.apply_americano_elo_for_tournament(p_tournament_id);

  IF COALESCE(v_apply->>'success', 'false')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_apply->>'error', 'Americano-ELO kunne ikke genberegnes')
      USING DETAIL = coalesce(v_apply::text, '');
  END IF;

  PERFORM public._admin_audit_log(
    'correct_americano_tournament',
    NULL,
    jsonb_build_object('tournament_id', p_tournament_id, 'matches_updated', v_updated)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'tournament_id', p_tournament_id,
    'matches_updated', v_updated,
    'elo', v_apply
  );

CREATE OR REPLACE FUNCTION public.admin_correct_league_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_score_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_m public.league_matches%ROWTYPE;
  v_score text;
  v_hi int;
  v_lo int;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun admin kan rette liga-resultater');
  END IF;
  IF p_match_id IS NULL OR p_winner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende kamp eller vinder');
  END IF;

  SELECT * INTO v_m
  FROM public.league_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kamp ikke fundet');
  END IF;

  IF v_m.status <> 'reported' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun rapporterede kampe kan rettes her');
  END IF;

  IF p_winner_id NOT IN (v_m.team1_id, v_m.team2_id) AND NOT (v_m.team2_id IS NULL AND p_winner_id = v_m.team1_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vinder skal være et af holdene i kampen');
  END IF;

  v_score := nullif(trim(p_score_text), '');
  IF v_score IS NOT NULL THEN
    IF v_score !~ '^\d+-\d+$' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Score skal skrives som X-Y, f.eks. 6-4');
    END IF;
    v_hi := GREATEST(
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[1]::int,
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[2]::int
    );
    v_lo := LEAST(
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[1]::int,
      (regexp_match(v_score, '^(\d+)-(\d+)$'))[2]::int
    );
    IF NOT (
      (v_hi = 6 AND v_lo <= 4)
      OR (v_hi = 7 AND v_lo IN (5, 6))
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error',
        'Ugyldig padel-score. Gyldige resultater: 6-0 → 6-4, 7-5 eller 7-6'
      );
    END IF;
  END IF;

  UPDATE public.league_matches
  SET
    winner_id = p_winner_id,
    score_text = v_score,
    status = 'reported',
    reported_by = COALESCE(v_m.reported_by, v_admin)
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', p_match_id,
    'league_id', v_m.league_id,
    'winner_id', p_winner_id,
    'score_text', v_score
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_correct_league_match(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_correct_league_match(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_americano_elo_for_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_creator_id uuid;
  v_status text;
  v_points_per_match integer;
  v_total_matches integer := 0;
  v_valid_matches integer := 0;
  v_player_count integer := 0;
  v_players_updated integer := 0;
  v_total_change integer := 0;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF p_tournament_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler tournament_id');
  END IF;

  SELECT t.creator_id, t.status, t.points_per_match
    INTO v_creator_id, v_status, v_points_per_match
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Turnering ikke fundet');
  END IF;

  IF v_actor_id <> v_creator_id AND NOT public.is_user_admin_verified(v_actor_id) THEN
    RETURN jsonb_build_object('error', 'Kun opretter eller admin må beregne Americano-ELO');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.americano_elo_history h
    WHERE h.tournament_id = p_tournament_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_applied', true,
      'players_updated', (
        SELECT COUNT(*)::int FROM public.americano_elo_history h
        WHERE h.tournament_id = p_tournament_id
      )
    );
  END IF;

  IF v_status <> 'completed' THEN
    RETURN jsonb_build_object('error', 'Turneringen skal være afsluttet før Americano-ELO kan beregnes');
  END IF;

  SELECT COUNT(*)::int
    INTO v_total_matches
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id;

  IF COALESCE(v_total_matches, 0) = 0 THEN
    RETURN jsonb_build_object('error', 'Turneringen har ingen kampe');
  END IF;

  SELECT COUNT(*)::int
    INTO v_valid_matches
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id
    AND m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND (m.team_a_score + m.team_b_score) = v_points_per_match;

  IF COALESCE(v_valid_matches, 0) <> COALESCE(v_total_matches, 0) THEN
    RETURN jsonb_build_object(
      'error',
      format(
        'Alle kampe skal være udfyldt korrekt før ELO-beregning (%s/%s gyldige).',
        COALESCE(v_valid_matches, 0),
        COALESCE(v_total_matches, 0)
      )
    );
  END IF;

  WITH participant_points AS (
    SELECT
      ap.id AS participant_id,
      ap.user_id,
      COALESCE(SUM(
        CASE
          WHEN ap.id IN (m.team_a_p1, m.team_a_p2) THEN COALESCE(m.team_a_score, 0)
          WHEN ap.id IN (m.team_b_p1, m.team_b_p2) THEN COALESCE(m.team_b_score, 0)
          ELSE 0
        END
      ), 0)::int AS points
    FROM public.americano_participants ap
    LEFT JOIN public.americano_matches m
      ON m.tournament_id = ap.tournament_id
    WHERE ap.tournament_id = p_tournament_id
    GROUP BY ap.id, ap.user_id
  ),
  rated AS (
    SELECT
      pp.participant_id,
      pp.user_id,
      pp.points,
      COALESCE(pr.americano_elo_rating, 1000)::int AS old_rating,
      COALESCE((
        SELECT COUNT(*)::int
        FROM public.americano_elo_history h
        WHERE h.user_id = pp.user_id
      ), 0)::int AS americano_played
    FROM participant_points pp
    JOIN public.profiles pr
      ON pr.id = pp.user_id
  ),
  pairwise AS (
    SELECT
      a.user_id,
      a.participant_id,
      a.points,
      a.old_rating,
      a.americano_played,
      SUM(
        CASE
          WHEN a.points > b.points THEN 1::numeric
          WHEN a.points = b.points THEN 0.5::numeric
          ELSE 0::numeric
        END
      ) AS actual_sum,
      SUM(
        1::numeric / (1::numeric + power(10::numeric, (b.old_rating - a.old_rating)::numeric / 400::numeric))
      ) AS expected_sum
    FROM rated a
    JOIN rated b
      ON b.user_id <> a.user_id
    GROUP BY a.user_id, a.participant_id, a.points, a.old_rating, a.americano_played
  ),
  deltas_raw AS (
    SELECT
      p.*,
      COUNT(*) OVER ()::int AS participant_count,
      CASE
        WHEN COALESCE(p.americano_played, 0) < 5 THEN 72::numeric
        WHEN COALESCE(p.americano_played, 0) < 20 THEN 56::numeric
        ELSE 40::numeric
      END AS k_value,
      (
        (
          CASE
            WHEN COALESCE(p.americano_played, 0) < 5 THEN 72::numeric
            WHEN COALESCE(p.americano_played, 0) < 20 THEN 56::numeric
            ELSE 40::numeric
          END
        ) * (p.actual_sum - p.expected_sum) / GREATEST(1, COUNT(*) OVER () - 1)::numeric
      ) AS delta_raw
    FROM pairwise p
  ),
  deltas_centered AS (
    SELECT
      d.*,
      (d.delta_raw - AVG(d.delta_raw) OVER ()) AS delta_raw_centered
    FROM deltas_raw d
  ),
  rounded AS (
    SELECT
      d.*,
      round(d.delta_raw_centered)::int AS delta_rounded
    FROM deltas_centered d
  ),
  rounded_total AS (
    SELECT COALESCE(SUM(delta_rounded), 0)::int AS total_delta
    FROM rounded
  ),
  correction_rank AS (
    SELECT
      r.*,
      (r.delta_rounded::numeric - r.delta_raw_centered) AS rounding_residual,
      rt.total_delta,
      CASE
        WHEN rt.total_delta > 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_raw_centered) DESC, r.delta_rounded DESC, r.user_id
        )
        WHEN rt.total_delta < 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_raw_centered) ASC, r.delta_rounded ASC, r.user_id
        )
        ELSE 0
      END AS correction_order
    FROM rounded r
    CROSS JOIN rounded_total rt
  ),
  final_deltas AS (
    SELECT
      c.user_id,
      c.participant_id,
      c.points,
      c.old_rating,
      c.americano_played,
      c.participant_count,
      (
        c.delta_rounded
        + CASE
            WHEN c.total_delta > 0 AND c.correction_order <= c.total_delta THEN -1
            WHEN c.total_delta < 0 AND c.correction_order <= abs(c.total_delta) THEN 1
            ELSE 0
          END
      )::int AS delta
    FROM correction_rank c
  ),
  ranked AS (
    SELECT
      f.*,
      dense_rank() OVER (ORDER BY f.points DESC) AS placement
    FROM final_deltas f
  ),
  capped AS (
    SELECT
      r.*,
      (100 - r.old_rating)::int AS min_delta,
      GREATEST(r.delta, (100 - r.old_rating))::int AS delta_capped
    FROM ranked r
  ),
  cap_totals AS (
    SELECT
      COALESCE(SUM(delta_capped - delta), 0)::int AS overflow_total
    FROM capped
  ),
  cap_order AS (
    SELECT
      c.*,
      GREATEST(c.delta_capped - c.min_delta, 0)::int AS give_back_capacity,
      row_number() OVER (ORDER BY c.delta_capped DESC, c.user_id) AS cap_order
    FROM capped c
  ),
  cap_alloc AS (
    SELECT
      co.*,
      ct.overflow_total,
      COALESCE(
        SUM(co.give_back_capacity) OVER (
          ORDER BY co.cap_order
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      )::int AS capacity_before
    FROM cap_order co
    CROSS JOIN cap_totals ct
  ),
  final_applied AS (
    SELECT
      ca.user_id,
      ca.participant_id,
      ca.points,
      ca.old_rating,
      ca.americano_played,
      ca.participant_count,
      ca.placement,
      (
        ca.delta_capped
        - LEAST(
            ca.give_back_capacity,
            GREATEST(ca.overflow_total - ca.capacity_before, 0)
          )
      )::int AS delta
    FROM cap_alloc ca
  ),
  updated_profiles AS (
    UPDATE public.profiles p
    SET
      americano_elo_rating = GREATEST(100, COALESCE(p.americano_elo_rating, 1000) + r.delta),
      americano_played = GREATEST(COALESCE(p.americano_played, 0), COALESCE(r.americano_played, 0) + 1)
    FROM final_applied r
    WHERE p.id = r.user_id
    RETURNING p.id, p.americano_elo_rating, p.americano_played
  ),
  inserted_history AS (
    INSERT INTO public.americano_elo_history (
      tournament_id,
      user_id,
      old_rating,
      new_rating,
      change,
      points,
      placement,
      participant_count
    )
    SELECT
      p_tournament_id,
      r.user_id,
      r.old_rating,
      GREATEST(100, r.old_rating + r.delta),
      r.delta,
      r.points,
      r.placement,
      r.participant_count
    FROM final_applied r
    RETURNING id, user_id, change
  )
  SELECT
    COALESCE((SELECT COUNT(*)::int FROM inserted_history), 0),
    COALESCE((SELECT SUM(change)::int FROM inserted_history), 0),
    COALESCE((SELECT MAX(participant_count) FROM ranked), 0)
  INTO v_players_updated, v_total_change, v_player_count;

  RETURN jsonb_build_object(
    'success', true,
    'players_updated', COALESCE(v_players_updated, 0),
    'participant_count', COALESCE(v_player_count, 0),
    'total_change', COALESCE(v_total_change, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_americano_elo_for_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_americano_elo_for_tournament(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_americano_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_creator_id uuid;
  v_status text;
  v_apply jsonb;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Mangler tournament_id';
  END IF;

  SELECT t.creator_id, t.status
    INTO v_creator_id, v_status
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turnering ikke fundet';
  END IF;

  IF v_actor_id <> v_creator_id AND NOT public.is_user_admin_verified(v_actor_id) THEN
    RAISE EXCEPTION 'Kun opretter eller admin må afslutte turneringen';
  END IF;

  IF v_status <> 'completed' THEN
    UPDATE public.americano_tournaments
    SET
      status = 'completed',
      updated_at = now(),
      completed_at = coalesce(completed_at, now())
    WHERE id = p_tournament_id;
  END IF;

  v_apply := public.apply_americano_elo_for_tournament(p_tournament_id);

  IF v_apply ? 'error' THEN
    RAISE EXCEPTION '%', COALESCE(v_apply->>'error', 'Ukendt Americano-ELO fejl');
  END IF;

  RETURN v_apply || jsonb_build_object(
    'success', true,
    'status_updated', (v_status <> 'completed')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_americano_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_americano_tournament(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
