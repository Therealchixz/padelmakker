-- BASELINE: produktionsskemaet pr. 2026-09-20.
--
-- Genereret af .github/workflows/dump-schema-baseline.yml med
-- `supabase db dump`. Rediger ikke i haanden - koer workflowen igen.
--
-- Findes FOER alle andre migrations (version 0), saa en frisk database
-- bygger skemaet foerst. Produktionen har indholdet i forvejen; derfor
-- skal denne version markeres som allerede anvendt med
-- `supabase migration repair --status applied 00000000000000`
-- FOER denne PR merges.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."_admin_audit_log"("p_action" "text", "p_target_user_id" "uuid" DEFAULT NULL::"uuid", "p_details" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR p_action IS NULL OR btrim(p_action) = '' THEN RETURN; END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (auth.uid(), btrim(p_action), p_target_user_id, COALESCE(p_details, '{}'::jsonb));
END; $$;


ALTER FUNCTION "public"."_admin_audit_log"("p_action" "text", "p_target_user_id" "uuid", "p_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_americano_entity_finished_at"("p_tournament_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_completed timestamptz;
  v_created timestamptz;
  v_updated timestamptz;
  v_date date;
  v_time_slot text;
  v_ts timestamptz;
BEGIN
  SELECT t.completed_at, t.created_at, t.updated_at, t.tournament_date, t.time_slot
    INTO v_completed, v_created, v_updated, v_date, v_time_slot
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_completed IS NOT NULL AND (v_created IS NULL OR v_completed > v_created + interval '1 minute') THEN
    RETURN v_completed;
  END IF;

  IF to_regclass('public.americano_elo_history') IS NOT NULL THEN
    SELECT max(h.created_at)
      INTO v_ts
    FROM public.americano_elo_history h
    WHERE h.tournament_id = p_tournament_id;

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;
  END IF;

  SELECT max(m.updated_at)
    INTO v_ts
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id
    AND m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL;

  IF v_ts IS NOT NULL THEN
    RETURN v_ts;
  END IF;

  IF v_updated IS NOT NULL AND (v_created IS NULL OR v_updated > v_created + interval '1 minute') THEN
    RETURN v_updated;
  END IF;

  IF v_date IS NOT NULL THEN
    RETURN (v_date::text || ' ' || coalesce(nullif(trim(v_time_slot), ''), '18:00'))::timestamptz;
  END IF;

  RETURN v_created;
END;
$$;


ALTER FUNCTION "public"."_americano_entity_finished_at"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_phone_confirmed timestamptz;
  v_email_confirmed timestamptz;
  v_exempt boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR COALESCE(v_profile.is_banned, false) THEN
    RETURN false;
  END IF;

  SELECT u.phone_confirmed_at, u.email_confirmed_at
    INTO v_phone_confirmed, v_email_confirmed
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_email_confirmed IS NULL THEN
    RETURN false;
  END IF;

  v_exempt := COALESCE(v_profile.phone_verification_exempt, false);

  IF v_phone_confirmed IS NULL AND NOT v_exempt THEN
    RETURN false;
  END IF;

  IF v_profile.birth_year IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(trim(v_profile.play_style), '') IN ('', 'Ved ikke endnu') THEN
    RETURN false;
  END IF;

  IF COALESCE(trim(v_profile.full_name), '') = ''
     OR lower(trim(v_profile.full_name)) IN ('ny spiller', 'ny', 'spiller') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_insert_system_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid" DEFAULT NULL::"uuid", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_et text := nullif(lower(trim(coalesce(p_entity_type, ''))), '');
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
  VALUES (p_user_id, p_type, p_title, p_body, p_match_id, v_et, p_entity_id, false);
END;
$$;


ALTER FUNCTION "public"."_insert_system_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_league_entity_finished_at"("p_league_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_completed timestamptz;
  v_created timestamptz;
  v_updated timestamptz;
  v_end_date date;
  v_ts timestamptz;
BEGIN
  SELECT l.completed_at, l.created_at, l.updated_at, l.end_date
    INTO v_completed, v_created, v_updated, v_end_date
  FROM public.leagues l
  WHERE l.id = p_league_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_completed IS NOT NULL AND (v_created IS NULL OR v_completed > v_created + interval '1 minute') THEN
    RETURN v_completed;
  END IF;

  IF to_regclass('public.league_matches') IS NOT NULL THEN
    SELECT max(lm.created_at)
      INTO v_ts
    FROM public.league_matches lm
    WHERE lm.league_id = p_league_id
      AND lm.status = 'reported';

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;
  END IF;

  IF v_updated IS NOT NULL AND (v_created IS NULL OR v_updated > v_created + interval '1 minute') THEN
    RETURN v_updated;
  END IF;

  IF v_end_date IS NOT NULL THEN
    RETURN v_end_date::timestamptz;
  END IF;

  RETURN v_created;
END;
$$;


ALTER FUNCTION "public"."_league_entity_finished_at"("p_league_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_result_error_entity_completed_at"("p_source_type" "text", "p_entity_id" "uuid") RETURNS timestamp with time zone
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ts timestamptz;
  v_created timestamptz;
BEGIN
  IF p_source_type = 'match_2v2' THEN
    SELECT m.completed_at, m.created_at
      INTO v_ts, v_created
    FROM public.matches m
    WHERE m.id = p_entity_id;

    IF v_ts IS NOT NULL AND (v_created IS NULL OR v_ts > v_created + interval '1 minute') THEN
      RETURN v_ts;
    END IF;

    SELECT max(mr.created_at)
      INTO v_ts
    FROM public.match_results mr
    WHERE mr.match_id = p_entity_id
      AND mr.confirmed = true;

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;

    SELECT (m.date::text || ' ' || coalesce(nullif(trim(m.time::text), ''), '12:00'))::timestamptz
      INTO v_ts
    FROM public.matches m
    WHERE m.id = p_entity_id AND m.date IS NOT NULL;

    RETURN v_ts;
  ELSIF p_source_type = 'americano' THEN
    RETURN public._americano_entity_finished_at(p_entity_id);
  ELSIF p_source_type = 'league' THEN
    RETURN public._league_entity_finished_at(p_entity_id);
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."_result_error_entity_completed_at"("p_source_type" "text", "p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_rpc_rate_limit_or_raise"("p_bucket" "text", "p_max" integer DEFAULT 30, "p_window_seconds" integer DEFAULT 3600) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text;
  v_window bigint;
  v_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF to_regprocedure('public.check_rate_limit(text,bigint,integer)') IS NULL THEN
    RETURN;
  END IF;

  v_key := 'rpc:' || coalesce(nullif(btrim(p_bucket), ''), 'default') || ':' || v_uid::text;
  v_window := floor(extract(epoch FROM now()) / GREATEST(1, p_window_seconds))::bigint;

  SELECT public.check_rate_limit(v_key, v_window, GREATEST(1, p_max))
  INTO v_ok;

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'For mange forsøg. Prøv igen senere.';
  END IF;
END;
$$;


ALTER FUNCTION "public"."_rpc_rate_limit_or_raise"("p_bucket" "text", "p_max" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_skip_duplicate_entity_notification"("p_user_id" "uuid", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_hours" integer DEFAULT 24) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.type = p_type
      AND n.entity_type = p_entity_type
      AND n.entity_id = p_entity_id
      AND n.created_at > now() - make_interval(hours => GREATEST(1, COALESCE(p_hours, 24)))
  );
$$;


ALTER FUNCTION "public"."_skip_duplicate_entity_notification"("p_user_id" "uuid", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_skip_duplicate_match_notification"("p_user_id" "uuid", "p_type" "text", "p_match_id" "uuid", "p_hours" integer DEFAULT 24) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.type = p_type
      AND n.match_id = p_match_id
      AND n.created_at > now() - make_interval(hours => GREATEST(1, COALESCE(p_hours, 24)))
  );
$$;


ALTER FUNCTION "public"."_skip_duplicate_match_notification"("p_user_id" "uuid", "p_type" "text", "p_match_id" "uuid", "p_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_adjust_americano_elo"("p_user_id" "uuid", "p_new_elo" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_current_elo int;
  v_target_base int;
  v_played int := 0;
  v_total_change int := 0;
  v_running_rating int;
  v_row record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Adgang nægtet: Kun admins kan justere Americano/Mexicano ELO manuelt.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Mangler bruger-id';
  END IF;

  IF p_new_elo IS NULL OR p_new_elo < 100 THEN
    RAISE EXCEPTION 'Ugyldig ELO-værdi (min 100).';
  END IF;

  SELECT COALESCE(americano_elo_rating, 1000)::int
  INTO v_current_elo
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_elo IS NULL THEN
    RAISE EXCEPTION 'Brugerprofil ikke fundet';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.americano_elo_history h WHERE h.user_id = p_user_id
  ) THEN
    SELECT COALESCE(SUM(change), 0)::int
    INTO v_total_change
    FROM public.americano_elo_history
    WHERE user_id = p_user_id;

    v_target_base := p_new_elo - v_total_change;
    v_running_rating := v_target_base;

    PERFORM set_config('app.skip_americano_elo_sync', '1', true);

    FOR v_row IN
      SELECT id, change
      FROM public.americano_elo_history
      WHERE user_id = p_user_id
      ORDER BY created_at ASC, tournament_id ASC, id ASC
    LOOP
      UPDATE public.americano_elo_history
      SET
        old_rating = v_running_rating,
        new_rating = v_running_rating + COALESCE(v_row.change, 0)
      WHERE id = v_row.id;

      v_running_rating := v_running_rating + COALESCE(v_row.change, 0);
    END LOOP;

    PERFORM set_config('app.skip_americano_elo_sync', '0', true);

    PERFORM public.recalc_americano_elo_from_history(p_user_id);

    SELECT COUNT(*)::int
    INTO v_played
    FROM public.americano_elo_history
    WHERE user_id = p_user_id;

    UPDATE public.profiles
    SET
      americano_elo_rating = p_new_elo,
      americano_played = COALESCE(v_played, americano_played)
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET americano_elo_rating = p_new_elo
    WHERE id = p_user_id;
  END IF;

  PERFORM public._admin_audit_log(
    'adjust_americano_elo',
    p_user_id,
    jsonb_build_object('new_elo', p_new_elo, 'previous_elo', v_current_elo)
  );
END;
$$;


ALTER FUNCTION "public"."admin_adjust_americano_elo"("p_user_id" "uuid", "p_new_elo" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_adjust_elo"("p_user_id" "uuid", "p_new_elo" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_elo int;
  v_diff int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin') THEN
    RAISE EXCEPTION 'Kun admins kan dette.';
  END IF;
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  v_diff := p_new_elo - COALESCE(v_current_elo, 1000);
  IF v_diff <> 0 THEN
    INSERT INTO public.elo_history (user_id, old_rating, new_rating, change, result, date, created_at, match_id)
    VALUES (p_user_id, COALESCE(v_current_elo, 1000), p_new_elo, v_diff, 'adjustment', now(), now(), null);
  END IF;
  PERFORM set_config('app.bypass_elo_protection', 'true', true);
  PERFORM public.recalc_profile_stats_from_elo_history(p_user_id);
  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;
  RETURN v_current_elo;
END;
$$;


ALTER FUNCTION "public"."admin_adjust_elo"("p_user_id" "uuid", "p_new_elo" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_audit_log_recent"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "actor_id" "uuid", "action" "text", "target_user_id" "uuid", "details" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_limit integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Kun admin med aktiv PIN-session'; END IF;
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  RETURN QUERY SELECT l.id, l.actor_id, l.action, l.target_user_id, l.details, l.created_at
  FROM public.admin_audit_log l ORDER BY l.created_at DESC LIMIT v_limit;
END; $$;


ALTER FUNCTION "public"."admin_audit_log_recent"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_clear_pin_session"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.admin_pin_sessions WHERE user_id = v_uid;
END;
$$;


ALTER FUNCTION "public"."admin_clear_pin_session"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_correct_americano_tournament"("p_tournament_id" "uuid", "p_matches" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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

  RETURN jsonb_build_object(
    'ok', true,
    'tournament_id', p_tournament_id,
    'matches_updated', v_updated,
    'elo', v_apply
  );
END;
$$;


ALTER FUNCTION "public"."admin_correct_americano_tournament"("p_tournament_id" "uuid", "p_matches" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_correct_league_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_score_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."admin_correct_league_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_score_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_correct_match_result_and_recalc_elo"("p_match_result_id" "uuid", "p_result" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', v_match_id,
    'score_display', v_score_display,
    'elo', v_elo
  );
END;
$$;


ALTER FUNCTION "public"."admin_correct_match_result_and_recalc_elo"("p_match_result_id" "uuid", "p_result" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_match"("p_match_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  IF NOT COALESCE(public.is_user_admin_verified(v_actor_id), false)
     AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'Admin-session udløbet — åbn Admin-fanen og indtast PIN igen.'
    );
  END IF;

  IF p_match_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mangler kamp-id');
  END IF;

  DELETE FROM public.matches WHERE id = p_match_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kampen blev ikke fundet');
  END IF;

  PERFORM public._admin_audit_log(
    'delete_match',
    NULL,
    jsonb_build_object('match_id', p_match_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."admin_delete_match"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  RETURN jsonb_build_object(
    'error',
    'App-versionen er for gammel til sletning. Opdater siden (Ctrl+F5) og prøv igen.'
  );
END;
$$;


ALTER FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_pin" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    SET "row_security" TO 'off'
    AS $_$
DECLARE
  v_actor_id uuid;
  v_target_email text;
  v_target_role text;
  v_mids uuid[];
  v_deleted_matches integer := 0;
  v_pin_check jsonb;
  v_pin_ok boolean := false;
  v_pin_reason text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;
  IF NOT public.has_admin_role() THEN
    RETURN jsonb_build_object('error', 'Kun admin kan slette spillere');
  END IF;
  v_pin_check := public.admin_verify_pin(p_pin, 5);
  v_pin_ok := COALESCE((v_pin_check->>'ok')::boolean, false);
  IF NOT v_pin_ok THEN
    v_pin_reason := COALESCE(v_pin_check->>'reason', 'invalid');
    IF v_pin_reason = 'locked' THEN
      RETURN jsonb_build_object('error', 'For mange forkerte kodeforsøg. Prøv igen senere.', 'reason', 'locked', 'locked_until', v_pin_check->>'locked_until');
    END IF;
    RETURN jsonb_build_object('error', 'Forkert eller manglende admin-kode');
  END IF;
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Mangler user_id'); END IF;
  IF p_user_id = v_actor_id THEN RETURN jsonb_build_object('error', 'Du kan ikke slette din egen admin-konto'); END IF;
  SELECT u.email INTO v_target_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_target_email IS NULL THEN RETURN jsonb_build_object('error', 'Bruger findes ikke i auth.users'); END IF;
  SELECT p.role INTO v_target_role FROM public.profiles p WHERE p.id = p_user_id;
  IF COALESCE(v_target_role, '') = 'admin' THEN RETURN jsonb_build_object('error', 'Admin-konti kan ikke slettes via denne handling'); END IF;
  IF to_regclass('public.league_matches') IS NOT NULL THEN
    EXECUTE 'UPDATE public.league_matches SET reported_by = NULL WHERE reported_by = $1' USING p_user_id;
  END IF;
  IF to_regclass('public.matches') IS NOT NULL AND to_regclass('public.match_players') IS NOT NULL THEN
    EXECUTE $SQL$ SELECT array_agg(DISTINCT m)::uuid[] FROM (SELECT id AS m FROM public.matches WHERE creator_id = $1 UNION SELECT match_id AS m FROM public.match_players WHERE user_id = $1 AND match_id IS NOT NULL) s $SQL$ INTO v_mids USING p_user_id;
  END IF;
  IF v_mids IS NOT NULL AND cardinality(v_mids) > 0 THEN
    IF to_regclass('public.match_results') IS NOT NULL THEN EXECUTE 'DELETE FROM public.match_results WHERE match_id = ANY ($1)' USING v_mids; END IF;
    EXECUTE 'DELETE FROM public.match_players WHERE match_id = ANY ($1)' USING v_mids;
    EXECUTE 'DELETE FROM public.matches WHERE id = ANY ($1)' USING v_mids;
    v_deleted_matches := cardinality(v_mids);
  END IF;
  IF to_regclass('public.elo_history') IS NOT NULL THEN EXECUTE 'DELETE FROM public.elo_history WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN EXECUTE 'DELETE FROM public.messages WHERE sender_id = $1 OR receiver_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.user_blocks') IS NOT NULL THEN EXECUTE 'DELETE FROM public.user_blocks WHERE blocker_id = $1 OR blocked_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.user_reports') IS NOT NULL THEN EXECUTE 'DELETE FROM public.user_reports WHERE reporter_id = $1 OR reported_id = $1 OR resolved_by = $1' USING p_user_id; END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN EXECUTE 'DELETE FROM public.push_subscriptions WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.americano_tournaments') IS NOT NULL THEN EXECUTE 'DELETE FROM public.americano_tournaments WHERE creator_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.americano_participants') IS NOT NULL THEN EXECUTE 'DELETE FROM public.americano_participants WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.league_participants') IS NOT NULL THEN EXECUTE 'DELETE FROM public.league_participants WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.leagues') IS NOT NULL THEN EXECUTE 'UPDATE public.leagues SET created_by = NULL WHERE created_by = $1' USING p_user_id; END IF;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  PERFORM public._admin_audit_log('delete_user', p_user_id, jsonb_build_object('deleted_email', v_target_email, 'deleted_matches', v_deleted_matches));
  RETURN jsonb_build_object('success', true, 'deleted_user_id', p_user_id, 'deleted_email', v_target_email, 'deleted_matches', v_deleted_matches);
END;
$_$;


ALTER FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_draw_growth_campaign"("p_slug" "text" DEFAULT 'first_200'::"text", "p_allow_partial" boolean DEFAULT false) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_campaign public.growth_campaigns%ROWTYPE;
  v_entry public.growth_campaign_entries%ROWTYPE;
  v_winner_name text;
  v_taken integer;
  v_prize text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_campaign
  FROM public.growth_campaigns
  WHERE slug = p_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_found');
  END IF;

  IF v_campaign.winner_user_id IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Spiller')
    INTO v_winner_name
    FROM public.profiles p
    WHERE p.id = v_campaign.winner_user_id;

    RETURN json_build_object(
      'ok', true,
      'already_drawn', true,
      'winner_user_id', v_campaign.winner_user_id,
      'winner_entry_number', v_campaign.winner_entry_number,
      'winner_name', v_winner_name,
      'draw_at', v_campaign.draw_at
    );
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  IF v_taken <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'no_entries');
  END IF;

  IF v_taken < v_campaign.max_entries AND NOT COALESCE(p_allow_partial, false) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'campaign_not_full',
      'spots_taken', v_taken,
      'spots_total', v_campaign.max_entries
    );
  END IF;

  SELECT e.* INTO v_entry
  FROM public.growth_campaign_entries e
  WHERE e.campaign_id = v_campaign.id
  ORDER BY random()
  LIMIT 1;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Spiller')
  INTO v_winner_name
  FROM public.profiles p
  WHERE p.id = v_entry.user_id;

  v_prize := coalesce(nullif(trim(v_campaign.prize_description), ''), 'Padel-præmie');

  UPDATE public.growth_campaigns
  SET
    winner_user_id = v_entry.user_id,
    winner_entry_number = v_entry.entry_number,
    drawn_by = v_admin,
    draw_at = now(),
    status = 'drawn',
    updated_at = now()
  WHERE id = v_campaign.id;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    v_entry.user_id,
    'growth_campaign_winner',
    'Tillykke — du har vundet Første 200! 🎁',
    'Du er trukket som vinder af lodtrækningen (lod #' || v_entry.entry_number || '). Vi kontakter dig snart om ' || v_prize || '.',
    false
  );

  IF to_regprocedure('public._admin_audit_log(text,uuid,jsonb)') IS NOT NULL THEN
    PERFORM public._admin_audit_log(
      'growth_campaign_draw',
      v_entry.user_id,
      jsonb_build_object(
        'slug', p_slug,
        'entry_number', v_entry.entry_number,
        'spots_taken', v_taken,
        'allow_partial', COALESCE(p_allow_partial, false)
      )
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'already_drawn', false,
    'winner_user_id', v_entry.user_id,
    'winner_entry_number', v_entry.entry_number,
    'winner_name', v_winner_name,
    'draw_at', now(),
    'spots_taken', v_taken
  );
END;
$$;


ALTER FUNCTION "public"."admin_draw_growth_campaign"("p_slug" "text", "p_allow_partial" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_dm_messages_between"("p_user_a" "uuid", "p_user_b" "uuid", "p_limit" integer DEFAULT 300) RETURNS TABLE("id" "uuid", "sender_id" "uuid", "receiver_id" "uuid", "content" "text", "created_at" timestamp with time zone, "is_read" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_limit integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin med verificeret PIN kan læse beskeder til anmeldelsesgennemgang';
  END IF;

  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RETURN;
  END IF;

  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 300), 500));

  RETURN QUERY
  SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at, m.is_read
  FROM public.messages m
  WHERE (
      (m.sender_id = p_user_a AND m.receiver_id = p_user_b)
      OR (m.sender_id = p_user_b AND m.receiver_id = p_user_a)
    )
  ORDER BY m.created_at ASC
  LIMIT v_limit;
END;
$$;


ALTER FUNCTION "public"."admin_get_dm_messages_between"("p_user_a" "uuid", "p_user_b" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_growth_campaign_draw_status"("p_slug" "text" DEFAULT 'first_200'::"text") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_campaign public.growth_campaigns%ROWTYPE;
  v_taken integer;
  v_winner_name text;
  v_drawn_by_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_campaign FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  IF v_campaign.winner_user_id IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Spiller')
    INTO v_winner_name
    FROM public.profiles p
    WHERE p.id = v_campaign.winner_user_id;
  END IF;

  IF v_campaign.drawn_by IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Admin')
    INTO v_drawn_by_name
    FROM public.profiles p
    WHERE p.id = v_campaign.drawn_by;
  END IF;

  RETURN json_build_object(
    'found', true,
    'slug', v_campaign.slug,
    'title', v_campaign.title,
    'spots_taken', v_taken,
    'spots_total', v_campaign.max_entries,
    'status', v_campaign.status,
    'can_draw', v_campaign.winner_user_id IS NULL AND v_taken > 0,
    'is_full', v_taken >= v_campaign.max_entries,
    'draw_completed', v_campaign.winner_user_id IS NOT NULL,
    'draw_at', v_campaign.draw_at,
    'winner_user_id', v_campaign.winner_user_id,
    'winner_entry_number', v_campaign.winner_entry_number,
    'winner_name', v_winner_name,
    'drawn_by_name', v_drawn_by_name
  );
END;
$$;


ALTER FUNCTION "public"."admin_get_growth_campaign_draw_status"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_admin_ids"() RETURNS "uuid"[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admins med aktiv PIN-session';
  END IF;

  RETURN coalesce(
    array_agg(p.id ORDER BY p.id),
    ARRAY[]::uuid[]
  )
  FROM public.profiles p
  WHERE lower(COALESCE(p.role, '')) = 'admin';
END;
$$;


ALTER FUNCTION "public"."admin_list_admin_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_growth_campaign_entries"("p_slug" "text" DEFAULT 'first_200'::"text") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_campaign_id FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF v_campaign_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(row_to_json(t) ORDER BY t.entry_number)
    FROM (
      SELECT
        e.entry_number,
        e.qualified_at,
        e.campaign_consent_at,
        e.user_id,
        p.full_name,
        p.name,
        p.area,
        p.created_at AS profile_created_at
      FROM public.growth_campaign_entries e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.campaign_id = v_campaign_id
      ORDER BY e.entry_number
    ) t
  ), '[]'::json);
END;
$$;


ALTER FUNCTION "public"."admin_list_growth_campaign_entries"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_open_result_error_reports_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) = 'admin'
    )
    THEN (
      SELECT count(*)::integer
      FROM public.result_error_reports r
      WHERE r.status = 'open'
    )
    ELSE 0
  END;
$$;


ALTER FUNCTION "public"."admin_open_result_error_reports_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_open_user_reports_count"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) = 'admin'
    )
    THEN (SELECT count(*)::integer FROM public.user_reports r WHERE r.status = 'open')
    ELSE 0
  END;
$$;


ALTER FUNCTION "public"."admin_open_user_reports_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_pin_status"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_has_pin boolean := false;
  v_verified_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Kun admins';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_pin_settings s WHERE s.user_id = v_uid
  ) INTO v_has_pin;

  SELECT sess.verified_until
  INTO v_verified_until
  FROM public.admin_pin_sessions sess
  WHERE sess.user_id = v_uid;

  RETURN jsonb_build_object(
    'has_pin', v_has_pin,
    'is_verified', COALESCE(v_verified_until > now(), false),
    'verified_until', v_verified_until
  );
END;
$$;


ALTER FUNCTION "public"."admin_pin_status"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "level" real DEFAULT 5.0,
    "play_style" "text" DEFAULT 'Ved ikke endnu'::"text",
    "area" "text" DEFAULT 'København'::"text",
    "availability" "text"[] DEFAULT '{}'::"text"[],
    "bio" "text" DEFAULT ''::"text",
    "avatar_emoji" "text" DEFAULT '🎾'::"text",
    "elo_rating" real DEFAULT 1000,
    "games_played" integer DEFAULT 0,
    "games_won" integer DEFAULT 0,
    "games_lost" integer DEFAULT 0,
    "best_streak" integer DEFAULT 0,
    "current_streak" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "avatar" "text" DEFAULT '🎾'::"text",
    "birth_year" integer,
    "americano_wins" integer DEFAULT 0 NOT NULL,
    "americano_losses" integer DEFAULT 0 NOT NULL,
    "americano_draws" integer DEFAULT 0 NOT NULL,
    "birth_month" integer,
    "birth_day" integer,
    "court_side" "text",
    "americano_played" integer DEFAULT 0 NOT NULL,
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "is_banned" boolean DEFAULT false NOT NULL,
    "ban_reason" "text",
    "latitude" double precision,
    "longitude" double precision,
    "travel_willing" boolean DEFAULT false NOT NULL,
    "intent_now" "text",
    "seeking_match" boolean DEFAULT false NOT NULL,
    "last_active_at" timestamp with time zone,
    "city" "text",
    "available_days" "text"[] DEFAULT '{}'::"text"[],
    "seeking_match_at" timestamp with time zone,
    "americano_elo_rating" integer DEFAULT 1000 NOT NULL,
    "preferred_partner_level" "text",
    "phone_verification_exempt" boolean DEFAULT false NOT NULL,
    "notification_prefs" "jsonb" DEFAULT '{"push": {"chat": true, "liga": true, "kampe": true, "system": true, "resultat": true, "invitation": true}}'::"jsonb" NOT NULL,
    "match_watch_enabled" boolean DEFAULT false NOT NULL,
    "match_watch_at" timestamp with time zone,
    "makker_search_prefs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "makker_watch_enabled" boolean DEFAULT false NOT NULL,
    "makker_watch_at" timestamp with time zone,
    "match_search_prefs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "profiles_birth_year_range" CHECK ((("birth_year" IS NULL) OR (("birth_year" >= 1920) AND ("birth_year" <= 2015))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."birth_month" IS 'Kun laesbar for service_role og via admin_profiles_with_email. Almindelige brugere ser kun birth_year.';



COMMENT ON COLUMN "public"."profiles"."birth_day" IS 'Kun laesbar for service_role og via admin_profiles_with_email. Almindelige brugere ser kun birth_year.';



COMMENT ON COLUMN "public"."profiles"."city" IS 'Valgfri by inden for profiles.area (region).';



COMMENT ON COLUMN "public"."profiles"."phone_verification_exempt" IS 'When true, user may use the app without verified phone (admin-only).';



COMMENT ON COLUMN "public"."profiles"."notification_prefs" IS 'Push kanal-toggles: kampe, resultat, liga, chat, invitation, system (admin inkl.).';



COMMENT ON COLUMN "public"."profiles"."makker_search_prefs" IS 'Mit makker-filter v2: notify, feedVisible, region, levelWindow, days, partnerCourtSide, playStyle, intents, intentMode, partnerLevel, availability.';



COMMENT ON COLUMN "public"."profiles"."makker_watch_enabled" IS 'Synkroniseret fra makker_search_prefs.notify — modtag makker_suggestion.';



COMMENT ON COLUMN "public"."profiles"."match_search_prefs" IS 'Mit kamp-filter: { version, notify, feedVisible, region, eloWindow, days[], openOnly }';



CREATE OR REPLACE FUNCTION "public"."admin_profiles_with_email"() RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC NULLS LAST;
END;
$$;


ALTER FUNCTION "public"."admin_profiles_with_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_restore_deleted_profile"("p_archive_id" "uuid", "p_target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    SET "row_security" TO 'off'
    AS $$
DECLARE v_actor_id uuid; v_archive public.deleted_players_archive%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN RETURN jsonb_build_object('error', 'Ikke logget ind'); END IF;
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('error', 'Kun admin med verificeret PIN kan restore profiler'); END IF;
  IF p_archive_id IS NULL OR p_target_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Mangler archive_id eller target_user_id'); END IF;
  SELECT * INTO v_archive FROM public.deleted_players_archive WHERE id = p_archive_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Archive entry ikke fundet'); END IF;
  IF v_archive.restored_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Denne archive entry er allerede restored'); END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN RETURN jsonb_build_object('error', 'target_user_id findes ikke i auth.users'); END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_target_user_id) THEN RETURN jsonb_build_object('error', 'Der findes allerede en profil for target_user_id'); END IF;
  INSERT INTO public.profiles SELECT (jsonb_populate_record(null::public.profiles, jsonb_set(v_archive.profile_snapshot, '{id}', to_jsonb(p_target_user_id), true))).*;
  UPDATE public.deleted_players_archive SET restored_at = now(), restored_by = v_actor_id, restored_user_id = p_target_user_id WHERE id = p_archive_id;
  PERFORM public._admin_audit_log('restore_deleted_profile', p_target_user_id, jsonb_build_object('archive_id', p_archive_id));
  RETURN jsonb_build_object('success', true, 'archive_id', p_archive_id, 'restored_user_id', p_target_user_id);
END; $$;


ALTER FUNCTION "public"."admin_restore_deleted_profile"("p_archive_id" "uuid", "p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_phone_verification_exempt"("p_user_id" "uuid", "p_exempt" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_meta_patch jsonb;
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

  v_meta_patch := jsonb_build_object('phone_verification_exempt', COALESCE(p_exempt, false));
  IF COALESCE(p_exempt, false) THEN
    v_meta_patch := v_meta_patch || jsonb_build_object('phone_verification_required', false);
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || v_meta_patch
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


ALTER FUNCTION "public"."admin_set_phone_verification_exempt"("p_user_id" "uuid", "p_exempt" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_setup_pin"("p_pin" "text", "p_remember_minutes" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_uid uuid := auth.uid();
  v_until timestamptz;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 30), 60));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;
  IF NOT public.has_admin_role() THEN RAISE EXCEPTION 'Kun admins'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'PIN skal være præcis 6 tal'; END IF;

  -- Findes der allerede en kode, kræver ændring en aktiv PIN-session (is_admin()),
  -- så et stjålet admin-JWT ikke kan sætte en ny kode og dermed omgå PIN-gaten.
  IF EXISTS (SELECT 1 FROM public.admin_pin_settings s WHERE s.user_id = v_uid)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Der findes allerede en admin-kode. Lås op med den nuværende kode først.';
  END IF;

  INSERT INTO public.admin_pin_settings AS s (user_id, pin_hash, failed_attempts, lock_until, updated_at)
  VALUES (v_uid, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, lock_until = NULL, updated_at = now();

  v_until := now() + make_interval(mins => v_minutes);
  INSERT INTO public.admin_pin_sessions AS sess (user_id, verified_until, updated_at)
  VALUES (v_uid, v_until, now())
  ON CONFLICT (user_id) DO UPDATE SET verified_until = EXCLUDED.verified_until, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'verified_until', v_until);
END;
$_$;


ALTER FUNCTION "public"."admin_setup_pin"("p_pin" "text", "p_remember_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_verify_pin"("p_pin" "text", "p_remember_minutes" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $_$
DECLARE v_uid uuid := auth.uid(); v_setting public.admin_pin_settings%ROWTYPE; v_until timestamptz; v_attempts integer;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 30), 60));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;
  IF NOT public.has_admin_role() THEN RAISE EXCEPTION 'Kun admins'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  SELECT * INTO v_setting FROM public.admin_pin_settings s WHERE s.user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_configured'); END IF;
  IF v_setting.lock_until IS NOT NULL AND v_setting.lock_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_setting.lock_until);
  END IF;
  IF extensions.crypt(p_pin, v_setting.pin_hash) <> v_setting.pin_hash THEN
    v_attempts := COALESCE(v_setting.failed_attempts, 0) + 1;
    UPDATE public.admin_pin_settings s SET failed_attempts = v_attempts,
      lock_until = CASE WHEN v_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END, updated_at = now() WHERE s.user_id = v_uid;
    RETURN jsonb_build_object('ok', false, 'reason', CASE WHEN v_attempts >= 5 THEN 'locked' ELSE 'invalid' END, 'attempts_left', GREATEST(0, 5 - v_attempts));
  END IF;
  UPDATE public.admin_pin_settings s SET failed_attempts = 0, lock_until = NULL, updated_at = now() WHERE s.user_id = v_uid;
  v_until := now() + make_interval(mins => v_minutes);
  INSERT INTO public.admin_pin_sessions AS sess (user_id, verified_until, updated_at) VALUES (v_uid, v_until, now())
  ON CONFLICT (user_id) DO UPDATE SET verified_until = EXCLUDED.verified_until, updated_at = now();
  PERFORM public._admin_audit_log('pin_verified', NULL, jsonb_build_object('remember_minutes', v_minutes));
  RETURN jsonb_build_object('ok', true, 'verified_until', v_until);
END; $_$;


ALTER FUNCTION "public"."admin_verify_pin"("p_pin" "text", "p_remember_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."americano_internal_tournament_creator"("p_tid" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT t.creator_id FROM public.americano_tournaments t WHERE t.id = p_tid LIMIT 1;
$$;


ALTER FUNCTION "public"."americano_internal_tournament_creator"("p_tid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."americano_internal_tournament_status"("p_tid" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT t.status FROM public.americano_tournaments t WHERE t.id = p_tid LIMIT 1;
$$;


ALTER FUNCTION "public"."americano_internal_tournament_status"("p_tid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."americano_is_participant"("p_tid" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.americano_participants p
    WHERE p.tournament_id = p_tid AND p.user_id = p_uid
  );
$$;


ALTER FUNCTION "public"."americano_is_participant"("p_tid" "uuid", "p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."americano_match_count_is_valid"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer, "p_actual_matches" integer) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_passes integer;
  v_base integer;
  v_min integer;
  v_max integer;
  v_legacy integer;
BEGIN
  IF p_actual_matches IS NULL OR p_actual_matches < 1 THEN RETURN false; END IF;
  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;
  v_base := public.americano_round_robin_base_rounds(p_participants, p_courts_per_round);
  v_min := v_base * v_passes;
  v_max := (v_base + p_participants * 4) * v_passes;
  IF p_actual_matches >= v_min AND p_actual_matches <= v_max THEN RETURN true; END IF;
  v_legacy := public.expected_americano_match_count_legacy(p_participants, p_opponent_passes);
  IF v_legacy IS NOT NULL AND p_actual_matches = v_legacy THEN RETURN true; END IF;
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."americano_match_count_is_valid"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer, "p_actual_matches" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."americano_round_robin_base_rounds"("p_participants" integer, "p_courts_per_round" integer DEFAULT 1) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT GREATEST(
    CASE
      WHEN p_participants % 2 = 0 THEN p_participants - 1
      ELSE p_participants
    END,
    CEIL(
      (p_participants * (p_participants - 1) / 2)::numeric
      / (2 * GREATEST(1, LEAST(GREATEST(COALESCE(p_courts_per_round, 1), 1), GREATEST(p_participants / 4, 1))))
    )::integer,
    CEIL(
      (p_participants * (p_participants - 1) / 2)::numeric
      / (4 * GREATEST(1, LEAST(GREATEST(COALESCE(p_courts_per_round, 1), 1), GREATEST(p_participants / 4, 1))))
    )::integer
  );
$$;


ALTER FUNCTION "public"."americano_round_robin_base_rounds"("p_participants" integer, "p_courts_per_round" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_americano_elo_for_tournament"("p_tournament_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."apply_americano_elo_for_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_elo_for_match"("p_match_result_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_match_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;
  v_out := public.apply_elo_for_match_core(p_match_result_id, v_uid, true);
  IF (v_out->>'success')::boolean IS TRUE THEN
    SELECT mr.match_id INTO v_match_id FROM public.match_results mr WHERE mr.id = p_match_result_id;
    IF v_match_id IS NOT NULL THEN
      PERFORM public.notify_elo_changes_for_match(v_match_id);
    END IF;
  END IF;
  RETURN v_out;
END;
$$;


ALTER FUNCTION "public"."apply_elo_for_match"("p_match_result_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_elo_for_match_core"("p_match_result_id" "uuid", "p_actor_id" "uuid", "p_require_actor" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_can_apply boolean := false;
  v_mr match_results%ROWTYPE;
  v_match matches%ROWTYPE;
  v_t1_won boolean;

  v_t1_games integer;
  v_t2_games integer;
  v_margin integer;
  v_margin_mult numeric;

  v_count_p integer;
  v_distinct_players integer;
  v_t1_count integer;
  v_t2_count integer;

  v_updated_count integer := 0;
  v_zero_sum_residual integer := 0;

  v_t1_changes integer[] := ARRAY[]::integer[];
  v_t2_changes integer[] := ARRAY[]::integer[];

  v_shadow jsonb := '{}'::jsonb;
BEGIN
  IF p_match_result_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing match_result_id');
  END IF;

  IF COALESCE(p_require_actor, true) AND p_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  SELECT * INTO v_mr
  FROM public.match_results
  WHERE id = p_match_result_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match result not found');
  END IF;

  IF v_mr.confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Match result not confirmed yet');
  END IF;

  IF NOT public.has_valid_match_result_confirmation(v_mr.match_id, v_mr.submitted_by, v_mr.confirmed_by) THEN
    RETURN jsonb_build_object('error', 'Result was not confirmed by an opposing team player or admin');
  END IF;

  IF COALESCE(p_require_actor, true) THEN
    SELECT
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.match_players mp
        WHERE mp.match_id = v_mr.match_id
          AND mp.user_id = p_actor_id
      )
    INTO v_can_apply;

    IF NOT v_can_apply THEN
      RETURN jsonb_build_object('error', 'Not authorized to apply ELO for this match');
    END IF;
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = v_mr.match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;

  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'ELO already calculated for this match');
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT user_id)::int,
    COUNT(*) FILTER (WHERE team = 1)::int,
    COUNT(*) FILTER (WHERE team = 2)::int
  INTO v_count_p, v_distinct_players, v_t1_count, v_t2_count
  FROM public.match_players
  WHERE match_id = v_mr.match_id;

  IF v_count_p <> 4 OR v_distinct_players <> 4 OR v_t1_count <> 2 OR v_t2_count <> 2 THEN
    RETURN jsonb_build_object('error', 'ELO requires exactly 2 unique players on each team');
  END IF;

  IF v_mr.match_winner <> 'team1' AND v_mr.match_winner <> 'team2' THEN
    RETURN jsonb_build_object('error', 'Match must have a distinct winner (team1 or team2) for ELO to apply');
  END IF;

  v_t1_won := (v_mr.match_winner = 'team1');

  v_t1_games :=
    COALESCE(v_mr.set1_team1, 0) + COALESCE(v_mr.set2_team1, 0) + COALESCE(v_mr.set3_team1, 0);
  v_t2_games :=
    COALESCE(v_mr.set1_team2, 0) + COALESCE(v_mr.set2_team2, 0) + COALESCE(v_mr.set3_team2, 0);
  v_margin := abs(v_t1_games - v_t2_games);

  v_margin_mult := CASE
    WHEN v_margin <= 4 THEN 1.0
    WHEN v_margin <= 9 THEN 1.20
    WHEN v_margin <= 14 THEN 1.40
    ELSE 1.60
  END;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);

  WITH participants AS (
    SELECT
      mp.user_id,
      mp.team,
      COALESCE(p.elo_rating, 1000)::numeric AS old_rating,
      COALESCE(p.games_played, 0)::int AS games_played
    FROM public.match_players mp
    JOIN public.profiles p ON p.id = mp.user_id
    WHERE mp.match_id = v_mr.match_id
  ),
  team_avg AS (
    SELECT
      team,
      AVG(old_rating)::numeric AS avg_rating
    FROM participants
    GROUP BY team
  ),
  base AS (
    SELECT
      p.user_id,
      p.team,
      p.old_rating,
      p.games_played,
      CASE WHEN p.team = 1 THEN t2.avg_rating ELSE t1.avg_rating END AS opp_avg,
      CASE
        WHEN (p.team = 1 AND v_t1_won) OR (p.team = 2 AND NOT v_t1_won) THEN 1::numeric
        ELSE 0::numeric
      END AS outcome,
      CASE
        WHEN p.games_played < 10 THEN 56::numeric
        WHEN p.games_played < 30 THEN 44::numeric
        ELSE 32::numeric
      END AS k_value
    FROM participants p
    CROSS JOIN (SELECT avg_rating FROM team_avg WHERE team = 1) t1
    CROSS JOIN (SELECT avg_rating FROM team_avg WHERE team = 2) t2
  ),
  raw AS (
    SELECT
      b.*,
      (1::numeric / (1::numeric + power(10::numeric, (b.opp_avg - b.old_rating) / 400::numeric))) AS expected,
      (
        b.k_value
        * (
            b.outcome
            - (1::numeric / (1::numeric + power(10::numeric, (b.opp_avg - b.old_rating) / 400::numeric)))
          )
        * v_margin_mult
      ) AS delta_raw
    FROM base b
  ),
  centered AS (
    SELECT
      r.*,
      (r.delta_raw - AVG(r.delta_raw) OVER ()) AS delta_centered
    FROM raw r
  ),
  rounded AS (
    SELECT
      c.*,
      round(c.delta_centered)::int AS delta_rounded
    FROM centered c
  ),
  rounded_total AS (
    SELECT COALESCE(SUM(delta_rounded), 0)::int AS total_delta
    FROM rounded
  ),
  correction_rank AS (
    SELECT
      r.*,
      (r.delta_rounded::numeric - r.delta_centered) AS rounding_residual,
      rt.total_delta,
      CASE
        WHEN rt.total_delta > 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_centered) DESC, r.delta_rounded DESC, r.user_id
        )
        WHEN rt.total_delta < 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_centered) ASC, r.delta_rounded ASC, r.user_id
        )
        ELSE 0
      END AS correction_order
    FROM rounded r
    CROSS JOIN rounded_total rt
  ),
  deltas_fixed AS (
    SELECT
      c.user_id,
      c.team,
      c.old_rating,
      c.games_played,
      c.outcome,
      c.k_value,
      c.expected,
      c.opp_avg,
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
  capped AS (
    SELECT
      d.*,
      (100 - d.old_rating)::int AS min_delta,
      GREATEST(d.delta, (100 - d.old_rating)::int)::int AS delta_capped
    FROM deltas_fixed d
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
      ca.team,
      ca.old_rating,
      ca.outcome,
      ca.k_value,
      ca.expected,
      ca.opp_avg,
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
      elo_rating = GREATEST(100, ROUND(f.old_rating + f.delta)::int),
      games_played = COALESCE(p.games_played, 0) + 1,
      games_won = COALESCE(p.games_won, 0) + CASE WHEN f.outcome = 1 THEN 1 ELSE 0 END
    FROM final_applied f
    WHERE p.id = f.user_id
    RETURNING p.id
  ),
  inserted_history AS (
    INSERT INTO public.elo_history (
      user_id,
      match_id,
      old_rating,
      new_rating,
      change,
      result
    )
    SELECT
      f.user_id,
      v_mr.match_id,
      f.old_rating,
      GREATEST(100, ROUND(f.old_rating + f.delta)::int),
      f.delta,
      CASE WHEN f.outcome = 1 THEN 'win' ELSE 'loss' END
    FROM final_applied f
    RETURNING id
  ),
  aggregates AS (
    SELECT
      COALESCE((SELECT COUNT(*)::int FROM inserted_history), 0) AS players_updated,
      COALESCE((SELECT SUM(delta)::int FROM final_applied), 0) AS total_delta,
      COALESCE((SELECT array_agg(delta ORDER BY user_id) FILTER (WHERE team = 1) FROM final_applied), ARRAY[]::int[]) AS t1_changes,
      COALESCE((SELECT array_agg(delta ORDER BY user_id) FILTER (WHERE team = 2) FROM final_applied), ARRAY[]::int[]) AS t2_changes
  )
  SELECT
    a.players_updated,
    a.total_delta,
    a.t1_changes,
    a.t2_changes
  INTO v_updated_count, v_zero_sum_residual, v_t1_changes, v_t2_changes
  FROM aggregates a;

  UPDATE public.matches
  SET status = 'completed', completed_at = now()
  WHERE id = v_mr.match_id;

  BEGIN
    v_shadow := public.apply_glicko2_shadow_for_match(p_match_result_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_shadow := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true,
    'model', 'elo_v2_individual_expected_zero_sum',
    'players_updated', COALESCE(v_updated_count, 0),
    'winner', v_mr.match_winner,
    'games_team1', v_t1_games,
    'games_team2', v_t2_games,
    'games_margin', v_margin,
    'margin_multiplier', v_margin_mult,
    'team1_player_changes', to_jsonb(v_t1_changes),
    'team2_player_changes', to_jsonb(v_t2_changes),
    'zero_sum_residual', COALESCE(v_zero_sum_residual, 0),
    'shadow', v_shadow
  );
END;
$$;


ALTER FUNCTION "public"."apply_elo_for_match_core"("p_match_result_id" "uuid", "p_actor_id" "uuid", "p_require_actor" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_elo_for_match_system"("p_match_result_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_out jsonb;
  v_match_id uuid;
BEGIN
  v_out := public.apply_elo_for_match_core(p_match_result_id, NULL, false);
  IF (v_out->>'success')::boolean IS TRUE THEN
    SELECT mr.match_id INTO v_match_id FROM public.match_results mr WHERE mr.id = p_match_result_id;
    IF v_match_id IS NOT NULL THEN
      PERFORM public.notify_elo_changes_for_match(v_match_id);
    END IF;
  END IF;
  RETURN v_out;
END;
$$;


ALTER FUNCTION "public"."apply_elo_for_match_system"("p_match_result_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_glicko2_shadow_for_match"("p_match_result_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_mr match_results%ROWTYPE;
  v_count_p integer;
  v_distinct_players integer;
  v_t1_count integer;
  v_t2_count integer;
  v_t1_won boolean;
  v_updated integer := 0;
BEGIN
  IF p_match_result_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing match_result_id');
  END IF;

  SELECT * INTO v_mr
  FROM public.match_results
  WHERE id = p_match_result_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match result not found');
  END IF;

  IF v_mr.match_winner <> 'team1' AND v_mr.match_winner <> 'team2' THEN
    RETURN jsonb_build_object('error', 'Match must have winner team1/team2');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.glicko2_shadow_history h
    WHERE h.match_id = v_mr.match_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_applied', true,
      'players_updated', (
        SELECT COUNT(*)::int
        FROM public.glicko2_shadow_history h
        WHERE h.match_id = v_mr.match_id
      )
    );
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT user_id)::int,
    COUNT(*) FILTER (WHERE team = 1)::int,
    COUNT(*) FILTER (WHERE team = 2)::int
  INTO v_count_p, v_distinct_players, v_t1_count, v_t2_count
  FROM public.match_players
  WHERE match_id = v_mr.match_id;

  IF v_count_p <> 4 OR v_distinct_players <> 4 OR v_t1_count <> 2 OR v_t2_count <> 2 THEN
    RETURN jsonb_build_object('error', 'Glicko shadow requires exactly 2 unique players on each team');
  END IF;

  v_t1_won := (v_mr.match_winner = 'team1');

  INSERT INTO public.glicko2_shadow_ratings (user_id)
  SELECT DISTINCT mp.user_id
  FROM public.match_players mp
  WHERE mp.match_id = v_mr.match_id
  ON CONFLICT (user_id) DO NOTHING;

  WITH participants AS (
    SELECT
      mp.user_id,
      mp.team,
      sr.rating,
      sr.rd,
      sr.volatility
    FROM public.match_players mp
    JOIN public.glicko2_shadow_ratings sr ON sr.user_id = mp.user_id
    WHERE mp.match_id = v_mr.match_id
  ),
  team_stats AS (
    SELECT
      team,
      AVG(rating)::numeric AS avg_rating,
      sqrt(AVG(power(rd::numeric, 2)))::numeric AS rms_rd
    FROM participants
    GROUP BY team
  ),
  prepared AS (
    SELECT
      p.user_id,
      p.team,
      p.rating AS old_rating,
      p.rd AS old_rd,
      p.volatility AS old_volatility,
      CASE WHEN p.team = 1 THEN t2.avg_rating ELSE t1.avg_rating END AS opp_rating,
      CASE WHEN p.team = 1 THEN t2.rms_rd ELSE t1.rms_rd END AS opp_rd,
      CASE
        WHEN (p.team = 1 AND v_t1_won) OR (p.team = 2 AND NOT v_t1_won) THEN 1::numeric
        ELSE 0::numeric
      END AS outcome
    FROM participants p
    CROSS JOIN (SELECT avg_rating, rms_rd FROM team_stats WHERE team = 1) t1
    CROSS JOIN (SELECT avg_rating, rms_rd FROM team_stats WHERE team = 2) t2
  ),
  computed AS (
    SELECT
      pr.*,
      upd.new_rating,
      upd.new_rd,
      upd.new_volatility,
      upd.expected
    FROM prepared pr
    CROSS JOIN LATERAL public.glicko2_shadow_update_one(
      pr.old_rating,
      pr.old_rd,
      pr.old_volatility,
      pr.opp_rating,
      pr.opp_rd,
      pr.outcome,
      0.5,
      0.000001
    ) upd
  ),
  updated AS (
    UPDATE public.glicko2_shadow_ratings sr
    SET
      rating = c.new_rating,
      rd = c.new_rd,
      volatility = c.new_volatility,
      games_played = COALESCE(sr.games_played, 0) + 1,
      last_match_at = now(),
      updated_at = now()
    FROM computed c
    WHERE sr.user_id = c.user_id
    RETURNING sr.user_id
  ),
  inserted_history AS (
    INSERT INTO public.glicko2_shadow_history (
      match_id,
      user_id,
      old_rating,
      new_rating,
      old_rd,
      new_rd,
      old_volatility,
      new_volatility,
      expected,
      outcome
    )
    SELECT
      v_mr.match_id,
      c.user_id,
      c.old_rating,
      c.new_rating,
      c.old_rd,
      c.new_rd,
      c.old_volatility,
      c.new_volatility,
      c.expected,
      c.outcome
    FROM computed c
    ON CONFLICT (match_id, user_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::int
  INTO v_updated
  FROM inserted_history;

  RETURN jsonb_build_object(
    'success', true,
    'players_updated', COALESCE(v_updated, 0)
  );
END;
$$;


ALTER FUNCTION "public"."apply_glicko2_shadow_for_match"("p_match_result_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_match_join_request"("p_request_id" "uuid", "p_match_id" "uuid", "p_user_id" "uuid", "p_user_name" "text", "p_user_emoji" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_creator_id UUID;
  v_t1         INT;
  v_t2         INT;
  v_team_num   INT;
  v_new_count  INT;
  v_req_status text;
  v_on_team    INT;
BEGIN
  SELECT status
  INTO v_req_status
  FROM public.match_join_requests
  WHERE id = p_request_id
    AND match_id = p_match_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
  END IF;

  IF lower(coalesce(v_req_status, '')) <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending');
  END IF;

  SELECT creator_id INTO v_creator_id
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;
  IF v_creator_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_creator');
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('approve_join', 60, 3600);
  END IF;

  UPDATE match_join_requests
  SET status = 'approved'
  WHERE id = p_request_id
    AND match_id = p_match_id
    AND user_id = p_user_id
    AND lower(coalesce(status, '')) = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending');
  END IF;

  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'match_full');
  END IF;

  v_team_num := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;

  IF (v_team_num = 1 AND v_t1 >= 2) OR (v_team_num = 2 AND v_t2 >= 2) THEN
    v_team_num := CASE WHEN v_team_num = 1 THEN 2 ELSE 1 END;
  END IF;

  IF (v_team_num = 1 AND v_t1 >= 2) OR (v_team_num = 2 AND v_t2 >= 2) THEN
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team_num);
  END IF;

  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, p_user_id, p_user_name, '', COALESCE(p_user_emoji, '🎾'), v_team_num)
  ON CONFLICT DO NOTHING;

  SELECT team INTO v_on_team
  FROM match_players
  WHERE match_id = p_match_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'insert_failed');
  END IF;

  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;

  IF v_t1 > 2 OR v_t2 > 2 THEN
    DELETE FROM match_players
    WHERE match_id = p_match_id AND user_id = p_user_id;
    UPDATE match_join_requests
    SET status = 'pending'
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team_num);
  END IF;

  SELECT COUNT(*) INTO v_new_count FROM match_players WHERE match_id = p_match_id;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE matches SET status = 'full', current_players = v_new_count, seeking_player = false WHERE id = p_match_id;
  ELSE
    UPDATE matches SET current_players = v_new_count WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', v_on_team);
END;
$$;


ALTER FUNCTION "public"."approve_match_join_request"("p_request_id" "uuid", "p_match_id" "uuid", "p_user_id" "uuid", "p_user_name" "text", "p_user_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_profile_before_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    SET "row_security" TO 'off'
    AS $$
declare
  v_actor_id uuid;
  v_actor_role text;
  v_email text;
begin
  v_actor_id := auth.uid();

  -- kun admins må arkivere/slette via dette flow
  select p.role
    into v_actor_role
  from public.profiles p
  where p.id = v_actor_id;

  if coalesce(v_actor_role, '') <> 'admin' then
    return old;
  end if;

  select u.email
    into v_email
  from auth.users u
  where u.id = old.id;

  insert into public.deleted_players_archive (
    deleted_by,
    old_user_id,
    email,
    full_name,
    reason,
    profile_snapshot,
    auth_snapshot
  )
  values (
    v_actor_id,
    old.id,
    v_email,
    coalesce(old.full_name, old.name),
    'admin_delete_user',
    to_jsonb(old),
    (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'phone', u.phone,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'raw_user_meta_data', u.raw_user_meta_data
      )
      from auth.users u
      where u.id = old.id
    )
  );

  return old;
end;
$$;


ALTER FUNCTION "public"."archive_profile_before_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_confirm_expired_match_results"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
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
$$;


ALTER FUNCTION "public"."auto_confirm_expired_match_results"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_user"("p_blocked_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig bruger');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke blokere spillere');
  END IF;

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (v_caller, p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."block_user"("p_blocked_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_confirm_match_result"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_mr public.match_results%ROWTYPE;
  v_submitter_team integer;
  v_confirmer_team integer;
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN
    RETURN false;
  END IF;

  -- Holdopstillingen låses fast på resultatrækken ved indsendelse. Den må ikke
  -- læses fra match_players, som spillerne selv kan ændre bagefter.
  SELECT *
  INTO v_mr
  FROM public.match_results mr
  WHERE mr.match_id = p_match_id
    AND mr.submitted_by IS NOT DISTINCT FROM p_submitted_by
  ORDER BY mr.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND AND (
       v_mr.team1_player1_id IS NOT NULL
    OR v_mr.team1_player2_id IS NOT NULL
    OR v_mr.team2_player1_id IS NOT NULL
    OR v_mr.team2_player2_id IS NOT NULL
  ) THEN
    v_confirmer_team := CASE
      WHEN p_confirmed_by = v_mr.team1_player1_id
        OR p_confirmed_by = v_mr.team1_player2_id THEN 1
      WHEN p_confirmed_by = v_mr.team2_player1_id
        OR p_confirmed_by = v_mr.team2_player2_id THEN 2
      ELSE NULL
    END;

    -- Bekræfteren skal stå på resultatet.
    IF v_confirmer_team IS NULL THEN
      RETURN false;
    END IF;

    v_submitter_team := CASE
      WHEN p_submitted_by = v_mr.team1_player1_id
        OR p_submitted_by = v_mr.team1_player2_id THEN 1
      WHEN p_submitted_by = v_mr.team2_player1_id
        OR p_submitted_by = v_mr.team2_player2_id THEN 2
      ELSE NULL
    END;

    -- System-indsendte rækker er neutrale: enhver på resultatet må bekræfte.
    IF v_submitter_team IS NULL THEN
      RETURN true;
    END IF;

    RETURN v_submitter_team <> v_confirmer_team;
  END IF;

  -- Fallback for gamle rækker uden holdsnapshot.
  SELECT mp.team
  INTO v_confirmer_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_confirmed_by
  LIMIT 1;

  IF v_confirmer_team IS NULL THEN
    RETURN false;
  END IF;

  SELECT mp.team
  INTO v_submitter_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_submitted_by
  LIMIT 1;

  IF v_submitter_team IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_submitter_team <> v_confirmer_team;
END;
$$;


ALTER FUNCTION "public"."can_confirm_match_result"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_play_intent"("p_intent_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_intent public.play_intents%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_intent FROM public.play_intents WHERE id = p_intent_id;
  IF NOT FOUND OR v_intent.user_id <> v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hensigten findes ikke');
  END IF;

  IF v_intent.status = 'proposed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Svar på forslaget i stedet');
  END IF;

  UPDATE public.play_intents SET status = 'cancelled' WHERE id = p_intent_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."cancel_play_intent"("p_intent_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."canonical_app_region"("p_area" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_raw    text := btrim(COALESCE(p_area, ''));
  v_lower  text;
  v_region text;
  v_regions constant text[] := ARRAY[
    'Nordjylland', 'Vestjylland', 'Østjylland', 'Sydjylland',
    'Fyn', 'Sjælland', 'Hovedstaden', 'Bornholm'
  ];
BEGIN
  IF v_raw = '' THEN
    RETURN '';
  END IF;

  v_lower := lower(v_raw);

  FOREACH v_region IN ARRAY v_regions LOOP
    IF lower(v_region) = v_lower THEN
      RETURN v_region;
    END IF;
  END LOOP;

  IF v_lower = 'region nordjylland' THEN RETURN 'Nordjylland'; END IF;
  IF v_lower = 'region hovedstaden' THEN RETURN 'Hovedstaden'; END IF;
  IF v_lower = 'region sjælland'    THEN RETURN 'Sjælland';    END IF;
  IF v_lower = 'region syddanmark'  THEN RETURN 'Sydjylland';  END IF;
  IF v_lower = 'sønderjylland'      THEN RETURN 'Sydjylland';  END IF;
  IF v_lower = 'region midtjylland' THEN RETURN 'Østjylland';  END IF;
  IF v_lower = 'københavn'          THEN RETURN 'Hovedstaden'; END IF;

  FOREACH v_region IN ARRAY v_regions LOOP
    IF position(lower(v_region) IN v_lower) > 0
       OR position(v_lower IN lower(v_region)) > 0 THEN
      RETURN v_region;
    END IF;
  END LOOP;

  RETURN v_raw;
END;
$$;


ALTER FUNCTION "public"."canonical_app_region"("p_area" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."canonical_app_region"("p_area" "text") IS 'Normaliserer profiles.area til kanonisk app-landsdel. Spejler canonicalAppRegion() i src/lib/appRegions.js.';



CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_key" "text", "p_window_start" bigint, "p_max" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_hits INT;
BEGIN
  DELETE FROM rate_limit_hits
  WHERE key = p_key AND window_start < p_window_start - 1;

  INSERT INTO rate_limit_hits (key, window_start, hits)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET hits = rate_limit_hits.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_max;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_key" "text", "p_window_start" bigint, "p_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_americano_tournament"("p_tournament_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."complete_americano_tournament"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_match_result_and_apply_elo"("p_match_result_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_mr public.match_results%ROWTYPE;
  v_uid uuid := auth.uid();
  v_elo jsonb;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_mr FROM public.match_results WHERE id = p_match_result_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Resultat ikke fundet');
  END IF;

  IF v_mr.confirmed IS TRUE THEN
    RETURN jsonb_build_object('error', 'Resultatet er allerede bekræftet');
  END IF;

  IF to_regprocedure('public.is_user_admin_verified(uuid)') IS NOT NULL
     AND public.is_user_admin_verified(v_uid) THEN
    v_allowed := true;
  ELSIF to_regprocedure('public.can_confirm_match_result(uuid, uuid, uuid)') IS NOT NULL
        AND public.can_confirm_match_result(v_mr.match_id, v_mr.submitted_by, v_uid) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'Resultatet skal bekræftes af en spiller fra modstanderholdet.');
  END IF;

  UPDATE public.match_results
  SET confirmed = true, confirmed_by = v_uid
  WHERE id = p_match_result_id;

  v_elo := public.apply_elo_for_match(p_match_result_id);

  IF v_elo IS NULL OR (v_elo ? 'error') THEN
    RAISE EXCEPTION 'ELO application failed: %', COALESCE(v_elo->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'elo', v_elo);
END;
$$;


ALTER FUNCTION "public"."confirm_match_result_and_apply_elo"("p_match_result_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_for_user"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid" DEFAULT NULL::"uuid", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_et text := nullif(lower(trim(coalesce(p_entity_type, ''))), '');
  v_last_notified timestamptz;
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;
  v_is_admin := COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false);

  IF p_type = 'seeking_player' THEN
    IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
      PERFORM public._rpc_rate_limit_or_raise('seeking_player', 3, 3600);
    END IF;
    IF p_match_id IS NULL THEN
      RAISE EXCEPTION 'Manglende match_id';
    END IF;
    SELECT m.seeking_player_notified_at INTO v_last_notified
    FROM public.matches m WHERE m.id = p_match_id FOR UPDATE;
    IF v_last_notified IS NOT NULL AND v_last_notified > now() - interval '30 minutes' THEN
      RAISE EXCEPTION 'Vent 30 min. før du råber op igen';
    END IF;
  ELSIF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('notification', 40, 3600);
  END IF;

  IF p_entity_id IS NOT NULL AND v_et IS NOT NULL AND p_type IN (
    'americano_full', 'league_full', 'americano_started', 'league_started',
    'americano_completed', 'league_completed', 'americano_spot_open'
  ) THEN
    IF public._skip_duplicate_entity_notification(p_user_id, p_type, v_et, p_entity_id, 24) THEN
      RETURN;
    END IF;
  END IF;

  IF p_user_id = v_caller THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, v_et, p_entity_id, false);
    IF p_type = 'seeking_player' AND p_match_id IS NOT NULL THEN
      UPDATE public.matches SET seeking_player_notified_at = now() WHERE id = p_match_id;
    END IF;
    RETURN;
  END IF;

  IF v_et = 'americano' AND p_entity_id IS NOT NULL AND p_type = 'americano_invite' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = p_entity_id AND t.creator_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Kun turneringens opretter kan sende Americano-invitationer';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, NULL, 'americano', p_entity_id, false);
    RETURN;
  END IF;

  IF v_et = 'americano' AND p_entity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.americano_participants ap
      WHERE ap.tournament_id = p_entity_id AND ap.user_id = v_caller
    ) AND NOT EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = p_entity_id AND t.creator_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Ingen adgang til at sende Americano-notifikation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.americano_participants ap
      WHERE ap.tournament_id = p_entity_id AND ap.user_id = p_user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.americano_tournaments t
      WHERE t.id = p_entity_id AND t.creator_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Modtager er ikke del af denne Americano-turnering';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, NULL, 'americano', p_entity_id, false);
    RETURN;
  END IF;

  IF v_et = 'league' AND p_entity_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_teams lt
      WHERE lt.league_id = p_entity_id
        AND (lt.player1_id = v_caller OR lt.player2_id = v_caller)
    ) AND NOT EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = p_entity_id AND l.created_by = v_caller
    ) AND NOT COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false) THEN
      RAISE EXCEPTION 'Ingen adgang til at sende liga-notifikation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.league_teams lt
      WHERE lt.league_id = p_entity_id
        AND (lt.player1_id = p_user_id OR lt.player2_id = p_user_id)
    ) AND NOT EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = p_entity_id AND l.created_by = p_user_id
    ) THEN
      RAISE EXCEPTION 'Modtager er ikke del af denne liga';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, NULL, 'league', p_entity_id, false);
    RETURN;
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Manglende match_id eller entity for notifikation til anden bruger';
  END IF;

  IF p_type = 'seeking_player' THEN
    IF NOT v_is_admin AND NOT EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
    ) AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_match_id AND m.creator_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, NULL, NULL, false);
    UPDATE public.matches SET seeking_player_notified_at = now() WHERE id = p_match_id;
    RETURN;
  END IF;

  IF p_type = 'match_invite' THEN
    IF NOT v_is_admin AND NOT EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
    ) AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_match_id AND m.creator_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Ingen adgang til at sende kampinvitation';
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, NULL, NULL, false);
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND m.creator_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Modtager er ikke relateret til denne kamp';
  END IF;

  IF v_is_admin OR EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND m.creator_id = v_caller
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, NULL, NULL, false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
END;
$$;


ALTER FUNCTION "public"."create_notification_for_user"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notifications_for_users"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid" DEFAULT NULL::"uuid", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE v_uid uuid; v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN RETURN 0; END IF;
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    BEGIN
      PERFORM public.create_notification_for_user(v_uid, p_type, p_title, p_body, p_match_id, p_entity_type, p_entity_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = 'P0001' OR position('Ingen adgang' in SQLERRM) > 0 OR position('Vent 30 min' in SQLERRM) > 0
         OR position('For mange' in SQLERRM) > 0 OR position('Rate limit' in SQLERRM) > 0 OR position('Manglende' in SQLERRM) > 0 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
  RETURN v_count;
END; $$;


ALTER FUNCTION "public"."create_notifications_for_users"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_play_intent"("p_play_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_intent_id uuid;
  v_form jsonb;
  v_pool integer;
  v_open_matches jsonb := '[]'::jsonb;
  v_row record;
  v_match_title text;
  v_match_body text;
  v_intent_region text;
  v_my_elo integer;
  v_today date;
  v_now_time time;
  v_formed boolean := false;
  v_elo_window constant integer := 250;
  v_max_open_matches constant integer := 5;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  IF p_play_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Udfyld dato og tidsrum');
  END IF;

  IF p_end_time <= p_start_time THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sluttidspunkt skal være efter start');
  END IF;

  IF (p_end_time - p_start_time) < interval '90 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg mindst 1½ time, så der er plads til en kamp');
  END IF;

  IF p_play_date < (now() AT TIME ZONE 'Europe/Copenhagen')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en dato i fremtiden');
  END IF;

  IF p_play_date > ((now() AT TIME ZONE 'Europe/Copenhagen')::date + 30) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Du kan melde dig klar op til 30 dage frem');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil findes ikke');
  END IF;

  IF COALESCE(v_profile.is_banned, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din profil er spærret');
  END IF;

  INSERT INTO public.play_intents
    (user_id, play_date, start_time, end_time, region, latitude, longitude, level)
  VALUES (
    v_caller,
    p_play_date,
    p_start_time,
    p_end_time,
    public.canonical_app_region(v_profile.area),
    v_profile.latitude,
    v_profile.longitude,
    public.match_filter_prefs_level('{}'::jsonb, v_profile.level::numeric)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_intent_id;

  IF v_intent_id IS NULL THEN
    SELECT id INTO v_intent_id
    FROM public.play_intents
    WHERE user_id = v_caller
      AND play_date = p_play_date
      AND start_time = p_start_time
      AND end_time = p_end_time
      AND status IN ('open', 'proposed')
    LIMIT 1;
  END IF;

  v_form := public.try_form_match_proposal(v_intent_id);
  v_formed := COALESCE((v_form->>'formed')::boolean, false);

  SELECT COUNT(*) INTO v_pool
  FROM public.play_intents i
  WHERE i.status = 'open'
    AND i.play_date = p_play_date
    AND i.user_id <> v_caller
    AND i.start_time < p_end_time
    AND i.end_time > p_start_time;

  v_intent_region := public.canonical_app_region(v_profile.area);
  v_my_elo := GREATEST(100, ROUND(COALESCE(v_profile.elo_rating, 1000))::integer);
  v_today := (now() AT TIME ZONE 'Europe/Copenhagen')::date;
  v_now_time := (now() AT TIME ZONE 'Europe/Copenhagen')::time;

  FOR v_row IN
    SELECT m.id, m.court_name, m.date, m.time,
           GREATEST(100, ROUND(COALESCE(c.elo_rating, 1000))::integer) AS match_elo
    FROM public.matches m
    JOIN public.profiles c ON c.id = m.creator_id
    WHERE COALESCE(m.status, '') = 'open'
      AND COALESCE(m.match_type, 'open') <> 'closed'
      AND COALESCE(m.current_players, 0) < COALESCE(m.max_players, 4)
      AND m.date = p_play_date
      AND m.creator_id IS DISTINCT FROM v_caller
      AND NOT EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = m.id AND mp.user_id = v_caller
      )
      AND public.play_intent_overlaps_match_time(
        p_start_time, p_end_time, m.time, m.time_end
      )
      AND (
        v_intent_region = ''
        OR public.canonical_app_region(c.area) = ''
        OR public.canonical_app_region(c.area) = v_intent_region
      )
      AND GREATEST(100, ROUND(COALESCE(c.elo_rating, 1000))::integer)
          BETWEEN v_my_elo - v_elo_window AND v_my_elo + v_elo_window
      AND (
        m.date > v_today
        OR public.parse_clock_time(m.time) IS NULL
        OR public.parse_clock_time(m.time) >= v_now_time
      )
    ORDER BY m.time NULLS LAST, m.created_at
    LIMIT v_max_open_matches
  LOOP
    v_open_matches := v_open_matches || jsonb_build_array(jsonb_build_object(
      'id', v_row.id,
      'court_name', COALESCE(NULLIF(trim(v_row.court_name), ''), 'en bane'),
      'date', v_row.date,
      'time', left(COALESCE(v_row.time, ''), 5)
    ));

    IF v_formed THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = v_caller
        AND n.type = 'match_watch_match'
        AND n.match_id = v_row.id
        AND n.created_at >= now() - interval '7 days'
    ) THEN
      CONTINUE;
    END IF;

    v_match_title := 'Åben kamp i dit tidsrum';
    v_match_body := format(
      'Åben kamp på %s%s%s · ELO ~%s',
      COALESCE(NULLIF(trim(v_row.court_name), ''), 'en bane'),
      CASE WHEN v_row.date IS NOT NULL THEN ' · ' || to_char(v_row.date::date, 'DD/MM') ELSE '' END,
      CASE WHEN v_row.time IS NOT NULL THEN ' kl. ' || left(v_row.time::text, 5) ELSE '' END,
      v_row.match_elo
    );

    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (v_caller, 'match_watch_match', v_match_title, v_match_body, v_row.id, false);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_intent_id,
    'others_waiting', v_pool,
    'proposal', v_form,
    'overlapping_matches', v_open_matches
  );
END;
$$;


ALTER FUNCTION "public"."create_play_intent"("p_play_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_rating_admin_flag"("p_source" "text", "p_reason" "text", "p_severity" "text" DEFAULT 'medium'::"text", "p_match_id" "uuid" DEFAULT NULL::"uuid", "p_tournament_id" "uuid" DEFAULT NULL::"uuid", "p_payload" "jsonb" DEFAULT '{}'::"jsonb", "p_notify_admins" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_source text;
  v_severity text;
  v_reason text;
  v_payload jsonb;
  v_flag_id uuid;
  v_inserted boolean := false;
BEGIN
  v_source := CASE WHEN p_source IN ('2v2', 'americano') THEN p_source ELSE '2v2' END;
  v_severity := CASE WHEN p_severity IN ('low', 'medium', 'high') THEN p_severity ELSE 'medium' END;
  v_reason := COALESCE(NULLIF(btrim(p_reason), ''), 'unspecified');
  v_payload := COALESCE(p_payload, '{}'::jsonb);

  BEGIN
    INSERT INTO public.rating_admin_flags (
      source,
      reason,
      severity,
      status,
      match_id,
      tournament_id,
      payload
    )
    VALUES (
      v_source,
      v_reason,
      v_severity,
      'open',
      p_match_id,
      p_tournament_id,
      v_payload
    )
    RETURNING id INTO v_flag_id;

    v_inserted := true;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT f.id
      INTO v_flag_id
      FROM public.rating_admin_flags f
      WHERE f.source = v_source
        AND f.reason = v_reason
        AND (
          (p_match_id IS NOT NULL AND f.match_id = p_match_id)
          OR (p_tournament_id IS NOT NULL AND f.tournament_id = p_tournament_id)
        )
      ORDER BY f.created_at DESC
      LIMIT 1;
  END;

  IF v_inserted AND COALESCE(p_notify_admins, true) AND to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT
        p.id,
        'system_flag',
        'Auto-flag: mulig ELO-manipulation',
        format(
          'Flag: %s (%s). Match: %s. Se Admin for vurdering.',
          v_reason,
          v_severity,
          COALESCE(p_match_id::text, 'n/a')
        ),
        p_match_id,
        false
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin';
    EXCEPTION
      WHEN OTHERS THEN
        -- Notifikation maa ikke blokere ELO-flow.
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'flag_id', v_flag_id
  );
END;
$$;


ALTER FUNCTION "public"."create_rating_admin_flag"("p_source" "text", "p_reason" "text", "p_severity" "text", "p_match_id" "uuid", "p_tournament_id" "uuid", "p_payload" "jsonb", "p_notify_admins" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_and_flag_suspicious_2v2_match"("p_match_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_player_count integer := 0;
  v_distinct_players integer := 0;
  v_team1_count integer := 0;
  v_team2_count integer := 0;
  v_same_quartet_14d integer := 0;
  v_max_abs_change integer := 0;
  v_min_abs_change integer := 0;
  v_sum_change integer := 0;
  v_open_flags integer := 0;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_match_id');
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT mp.user_id)::int,
    COUNT(*) FILTER (WHERE mp.team = 1)::int,
    COUNT(*) FILTER (WHERE mp.team = 2)::int
  INTO v_player_count, v_distinct_players, v_team1_count, v_team2_count
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id;

  IF v_player_count <> 4 OR v_distinct_players <> 4 OR v_team1_count <> 2 OR v_team2_count <> 2 THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'not_standard_2v2');
  END IF;

  -- Vent til alle 4 ELO-raekker er skrevet.
  IF (
    SELECT COUNT(*)::int
    FROM public.elo_history eh
    WHERE eh.match_id = p_match_id
  ) < 4 THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'elo_rows_not_ready');
  END IF;

  WITH this_sig AS (
    SELECT string_agg(mp.user_id::text, ',' ORDER BY mp.user_id::text) AS sig
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
  ),
  recent_match_sigs AS (
    SELECT
      m.id AS match_id,
      string_agg(mp.user_id::text, ',' ORDER BY mp.user_id::text) AS sig
    FROM public.matches m
    JOIN public.match_players mp ON mp.match_id = m.id
    WHERE m.status = 'completed'
      AND COALESCE(m.completed_at, now()) >= now() - interval '14 days'
    GROUP BY m.id
    HAVING COUNT(*) = 4 AND COUNT(DISTINCT mp.user_id) = 4
  )
  SELECT COUNT(*)::int
  INTO v_same_quartet_14d
  FROM recent_match_sigs r
  JOIN this_sig t ON t.sig = r.sig;

  SELECT
    COALESCE(MAX(abs(eh.change)), 0)::int,
    COALESCE(MIN(abs(eh.change)), 0)::int,
    COALESCE(SUM(eh.change), 0)::int
  INTO v_max_abs_change, v_min_abs_change, v_sum_change
  FROM public.elo_history eh
  WHERE eh.match_id = p_match_id;

  IF v_same_quartet_14d >= 8 THEN
    PERFORM public.create_rating_admin_flag(
      '2v2',
      'repeated_quartet_high_volume_14d',
      'high',
      p_match_id,
      NULL,
      jsonb_build_object(
        'same_quartet_14d', v_same_quartet_14d,
        'window_days', 14
      ),
      true
    );
  END IF;

  IF abs(v_sum_change) > 0 THEN
    PERFORM public.create_rating_admin_flag(
      '2v2',
      'non_zero_sum_match_delta',
      'medium',
      p_match_id,
      NULL,
      jsonb_build_object(
        'sum_change', v_sum_change,
        'max_abs_change', v_max_abs_change,
        'min_abs_change', v_min_abs_change
      ),
      true
    );
  END IF;

  IF v_max_abs_change >= 60 AND v_min_abs_change <= 3 THEN
    PERFORM public.create_rating_admin_flag(
      '2v2',
      'extreme_delta_spread',
      'medium',
      p_match_id,
      NULL,
      jsonb_build_object(
        'max_abs_change', v_max_abs_change,
        'min_abs_change', v_min_abs_change
      ),
      true
    );
  END IF;

  SELECT COUNT(*)::int
  INTO v_open_flags
  FROM public.rating_admin_flags f
  WHERE f.match_id = p_match_id
    AND f.status = 'open';

  RETURN jsonb_build_object(
    'success', true,
    'same_quartet_14d', v_same_quartet_14d,
    'max_abs_change', v_max_abs_change,
    'min_abs_change', v_min_abs_change,
    'sum_change', v_sum_change,
    'open_flags_for_match', v_open_flags
  );
END;
$$;


ALTER FUNCTION "public"."detect_and_flag_suspicious_2v2_match"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.discovery_notifications_today_count(
    p_user_id,
    ARRAY['match_watch_match', 'makker_suggestion']::text[]
  );
$$;


ALTER FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid", "p_types" "text"[] DEFAULT ARRAY['match_watch_match'::"text", 'makker_suggestion'::"text"]) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::integer
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.type = ANY (p_types)
    AND n.created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Copenhagen');
$$;


ALTER FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid", "p_types" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispatch_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_type" "text", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_secret text;
  v_anon_key text;
  v_req_id bigint;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_title), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT value INTO v_secret
  FROM public.app_config
  WHERE key = 'reminder_cron_secret';

  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE WARNING 'dispatch_push_to_user: app_config.reminder_cron_secret mangler - push blev ikke sendt';
    RETURN NULL;
  END IF;

  SELECT value INTO v_anon_key
  FROM public.app_config
  WHERE key = 'anon_key';

  IF v_anon_key IS NULL OR length(v_anon_key) < 32 THEN
    RAISE WARNING 'dispatch_push_to_user: app_config.anon_key mangler - push blev ikke sendt';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/dispatch-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key,
      'x-cron-secret', v_secret
    ),
    body := jsonb_strip_nulls(jsonb_build_object(
      'targetUserId', p_user_id,
      'title', p_title,
      'body', COALESCE(p_body, ''),
      'type', COALESCE(NULLIF(btrim(p_type), ''), 'makker_suggestion'),
      'entityType', p_entity_type,
      'entityId', p_entity_id
    ))
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$$;


ALTER FUNCTION "public"."dispatch_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dm_message_preview"("p_message_type" "text", "p_content" "text", "p_payload" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$ SELECT CASE coalesce(p_message_type, 'text') WHEN 'match_invite' THEN coalesce(p_payload->>'title', '🎾 Kamp-invitation') WHEN 'venue_share' THEN coalesce('📍 ' || nullif(p_payload->>'venue', ''), '📍 Bane') WHEN 'time_suggestion' THEN coalesce('📅 ' || nullif(p_payload->>'label', ''), '📅 Tidforslag') ELSE coalesce(nullif(btrim(p_content), ''), '') END; $$;


ALTER FUNCTION "public"."dm_message_preview"("p_message_type" "text", "p_content" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dm_users_blocked"("p_user_a" "uuid", "p_user_b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = p_user_a AND b.blocked_id = p_user_b)
       OR (b.blocker_id = p_user_b AND b.blocked_id = p_user_a)
  );
$$;


ALTER FUNCTION "public"."dm_users_blocked"("p_user_a" "uuid", "p_user_b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_max_players"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current int;
  v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM match_players WHERE match_id = NEW.match_id;
  SELECT max_players INTO v_max FROM matches WHERE id = NEW.match_id;

  IF v_current >= COALESCE(v_max, 4) THEN
    RAISE EXCEPTION 'Kampen er fuld (% / % spillere)', v_current, v_max;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_max_players"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enroll_growth_campaign"("p_slug" "text" DEFAULT 'first_200'::"text", "p_consent" boolean DEFAULT true) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign public.growth_campaigns%ROWTYPE;
  v_existing public.growth_campaign_entries%ROWTYPE;
  v_taken integer;
  v_next integer;
  v_row public.growth_campaign_entries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF COALESCE(p_consent, false) IS NOT TRUE THEN
    RETURN json_build_object('ok', false, 'error', 'consent_required');
  END IF;

  -- FOR UPDATE: uden låsen kan to samtidige tilmeldinger beregne det samme
  -- entry_number og ramme UNIQUE (campaign_id, entry_number) med en rå 500-fejl.
  SELECT * INTO v_campaign
  FROM public.growth_campaigns
  WHERE slug = p_slug
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_active');
  END IF;

  IF v_campaign.status <> 'active' THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_active');
  END IF;

  IF NOT public._growth_user_qualified(v_uid) THEN
    RETURN json_build_object('ok', false, 'error', 'not_qualified');
  END IF;

  SELECT * INTO v_existing
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id AND user_id = v_uid;

  IF FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'already_enrolled', true,
      'entry_number', v_existing.entry_number
    );
  END IF;

  SELECT COALESCE(max(entry_number), 0)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  IF v_taken >= v_campaign.max_entries THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_full', 'spots_taken', v_taken);
  END IF;

  v_next := v_taken + 1;

  INSERT INTO public.growth_campaign_entries (campaign_id, user_id, entry_number, campaign_consent_at)
  VALUES (v_campaign.id, v_uid, v_next, now())
  ON CONFLICT (campaign_id, user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.growth_campaign_entries
    WHERE campaign_id = v_campaign.id AND user_id = v_uid;
    RETURN json_build_object(
      'ok', true,
      'already_enrolled', true,
      'entry_number', v_existing.entry_number
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'already_enrolled', false,
    'entry_number', v_row.entry_number,
    'spots_taken', v_next
  );
END;
$$;


ALTER FUNCTION "public"."enroll_growth_campaign"("p_slug" "text", "p_consent" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_passes integer;
BEGIN
  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;

  IF p_participants = 8 THEN
    RETURN 14;
  ELSIF p_participants BETWEEN 5 AND 7 THEN
    RETURN p_participants * v_passes;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer DEFAULT 1) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_passes integer;
  v_base integer;
BEGIN
  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;
  v_base := public.americano_round_robin_base_rounds(p_participants, p_courts_per_round);
  RETURN v_base * v_passes;
END;
$$;


ALTER FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expected_americano_match_count_legacy"("p_participants" integer, "p_opponent_passes" integer) RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_passes integer;
BEGIN
  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;
  IF p_participants = 8 AND v_passes = 1 THEN RETURN 14;
  ELSIF p_participants = 8 AND v_passes = 2 THEN RETURN 28;
  ELSIF p_participants BETWEEN 5 AND 7 THEN RETURN p_participants * v_passes;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."expected_americano_match_count_legacy"("p_participants" integer, "p_opponent_passes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_abandoned_in_progress_matches"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.matches mt
  SET status = 'cancelled',
      seeking_player = false
  WHERE mt.status = 'in_progress'
    AND mt.time ~ '^\d{1,2}:\d{2}'
    AND NOT EXISTS (SELECT 1 FROM public.match_results r WHERE r.match_id = mt.id)
    AND (
      CASE
        WHEN mt.time_end ~ '^\d{1,2}:\d{2}'
          THEN ((mt.date::text || ' ' || mt.time_end)::timestamp AT TIME ZONE 'Europe/Copenhagen')
        ELSE ((mt.date::text || ' ' || coalesce(nullif(mt.time, ''), '00:00'))::timestamp
              AT TIME ZONE 'Europe/Copenhagen') + interval '90 minutes'
      END
    ) < now() - interval '48 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."expire_abandoned_in_progress_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_stale_play_intents"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_proposals integer := 0;
  v_reopened integer := 0;
  v_ghosted integer := 0;
  v_intents integer := 0;
  v_seed uuid;
  v_formed jsonb := NULL;
BEGIN
  WITH stale AS (
    UPDATE public.match_proposals
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_proposals FROM stale;

  -- De der nåede at sige ja er stadig friske og ryger tilbage i puljen.
  WITH back AS (
    UPDATE public.play_intents i
    SET status = 'open', proposal_id = NULL
    FROM public.match_proposal_members m
    JOIN public.match_proposals p ON p.id = m.proposal_id
    WHERE m.intent_id = i.id
      AND i.status = 'proposed'
      AND p.status = 'expired'
      AND m.response = 'accepted'
    RETURNING i.id
  )
  SELECT COUNT(*) INTO v_reopened FROM back;

  -- De der aldrig svarede tages ud. Ellers ville næste kørsel danne præcis
  -- samme døde gruppe igen, inklusive den der ikke reagerede.
  WITH ghosts AS (
    UPDATE public.play_intents i
    SET status = 'cancelled', proposal_id = NULL
    FROM public.match_proposal_members m
    JOIN public.match_proposals p ON p.id = m.proposal_id
    WHERE m.intent_id = i.id
      AND i.status = 'proposed'
      AND p.status = 'expired'
      AND m.response <> 'accepted'
    RETURNING i.id
  )
  SELECT COUNT(*) INTO v_ghosted FROM ghosts;

  WITH gone AS (
    UPDATE public.play_intents
    SET status = 'expired'
    WHERE status IN ('open', 'proposed')
      AND play_date < (now() AT TIME ZONE 'Europe/Copenhagen')::date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_intents FROM gone;

  -- Selvhelbredende: de frigivne skal ikke vente på at en ny bruger dukker op.
  IF v_reopened > 0 THEN
    SELECT id INTO v_seed
    FROM public.play_intents
    WHERE status = 'open'
      AND play_date >= (now() AT TIME ZONE 'Europe/Copenhagen')::date
    ORDER BY created_at
    LIMIT 1;

    IF v_seed IS NOT NULL THEN
      v_formed := public.try_form_match_proposal(v_seed);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'proposals_expired', v_proposals,
    'intents_reopened', v_reopened,
    'intents_ghosted', v_ghosted,
    'intents_expired', v_intents,
    'reformed', v_formed
  );
END;
$$;


ALTER FUNCTION "public"."expire_stale_play_intents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_unstarted_matches"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.matches mt
  SET status = 'cancelled',
      seeking_player = false,
      current_players = 0
  WHERE mt.status IN ('open', 'full')
    AND mt.started_at IS NULL
    AND mt.time ~ '^\d{1,2}:\d{2}'
    AND (
      CASE
        WHEN mt.time_end ~ '^\d{1,2}:\d{2}'
          THEN ((mt.date::text || ' ' || mt.time_end)::timestamp AT TIME ZONE 'Europe/Copenhagen')
        ELSE ((mt.date::text || ' ' || coalesce(nullif(mt.time, ''), '00:00'))::timestamp
              AT TIME ZONE 'Europe/Copenhagen') + interval '90 minutes'
      END
    ) < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."expire_unstarted_matches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_match_message_counts"("p_match_ids" "uuid"[]) RETURNS TABLE("match_id" "uuid", "message_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT mm.match_id, COUNT(*)::bigint AS message_count
  FROM public.match_messages mm
  WHERE p_match_ids IS NOT NULL
    AND cardinality(p_match_ids) > 0
    AND mm.match_id = ANY(p_match_ids)
  GROUP BY mm.match_id;
$$;


ALTER FUNCTION "public"."fetch_match_message_counts"("p_match_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_padel_level"("p_level" numeric) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT rtrim(rtrim(to_char(COALESCE(p_level, 0), 'FM9.9'), '0'), '.');
$$;


ALTER FUNCTION "public"."format_padel_level"("p_level" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."format_padel_level"("p_level" numeric) IS 'Niveau uden efterladt komma/nul: 3.0 -> 3, 3.5 -> 3.5.';



CREATE OR REPLACE FUNCTION "public"."get_due_reactivation_nudges"() RETURNS TABLE("user_id" "uuid", "city_label" "text", "open_count" integer, "week_start" "date")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with week_bounds as (
    select
      (date_trunc('week', timezone('Europe/Copenhagen', now())))::date as week_start,
      ((date_trunc('week', timezone('Europe/Copenhagen', now())))::date + interval '7 days')::date as week_end,
      (timezone('Europe/Copenhagen', now()))::date as today_cph
  ),
  open_matches as (
    select
      m.id,
      m.creator_id,
      m.date::date as match_date,
      cr.latitude as creator_lat,
      cr.longitude as creator_lon,
      cr.area as creator_area
    from public.matches m
    join public.profiles cr on cr.id = m.creator_id
    cross join week_bounds wb
    where coalesce(m.status, '') = 'open'
      and coalesce(m.match_type, 'open') <> 'closed'
      and coalesce(m.current_players, 0) < coalesce(m.max_players, 4)
      and m.date is not null
      and m.date::date >= wb.week_start
      and m.date::date < wb.week_end
      and (
        case
          when m.time ~ '^\d{1,2}:\d{2}' then
            (
              case
                when m.time_end ~ '^\d{1,2}:\d{2}'
                  then ((m.date::text || ' ' || m.time_end)::timestamp at time zone 'Europe/Copenhagen')
                else ((m.date::text || ' ' || m.time)::timestamp at time zone 'Europe/Copenhagen') + interval '90 minutes'
              end
            ) >= now()
          else m.date::date >= wb.today_cph
        end
      )
  ),
  candidates as (
    select
      p.id as user_id,
      nullif(trim(coalesce(p.city, '')), '') as city_label,
      p.latitude as user_lat,
      p.longitude as user_lon,
      p.area as user_area,
      case
        when coalesce(nullif(trim(p.notification_prefs->>'reactivationOpenMatches'), ''), 'weekly')
          in ('off', 'weekly', 'daily')
          then coalesce(nullif(trim(p.notification_prefs->>'reactivationOpenMatches'), ''), 'weekly')
        else 'weekly'
      end as nudge_freq
    from public.profiles p
    where coalesce(p.is_banned, false) = false
      and coalesce(p.games_played, 0) = 0
      and nullif(trim(coalesce(p.area, '')), '') is not null
      and nullif(trim(coalesce(p.city, '')), '') is not null
      and p.latitude is not null
      and p.longitude is not null
      and p.birth_year is not null
      and nullif(trim(coalesce(p.play_style, '')), '') is not null
      and trim(coalesce(p.play_style, '')) <> 'Ved ikke endnu'
      and cardinality(coalesce(p.availability, '{}'::text[])) > 0
      and exists (
        select 1 from public.push_subscriptions ps where ps.user_id = p.id
      )
      and coalesce(p.notification_prefs->>'pushLevel', 'all') <> 'off'
      and coalesce(nullif(trim(p.notification_prefs->>'reactivationOpenMatches'), ''), 'weekly') <> 'off'
  ),
  scored as (
    select
      c.user_id,
      c.city_label,
      c.nudge_freq,
      count(distinct om.id)::integer as open_count
    from candidates c
    cross join week_bounds wb
    join open_matches om on om.creator_id <> c.user_id
    where (
      (
        om.creator_lat is not null
        and om.creator_lon is not null
        and public.haversine_km(c.user_lat, c.user_lon, om.creator_lat, om.creator_lon) <= 60
      )
      or (
        (om.creator_lat is null or om.creator_lon is null)
        and lower(trim(coalesce(om.creator_area, ''))) = lower(trim(coalesce(c.user_area, '')))
      )
    )
    group by c.user_id, c.city_label, c.nudge_freq
    having count(distinct om.id) >= 2
  )
  select s.user_id, s.city_label, s.open_count, wb.week_start
  from scored s
  cross join week_bounds wb
  where not exists (
    select 1
    from public.reactivation_log rl
    where rl.user_id = s.user_id
      and rl.kind = 'open_matches_weekly'
      and (
        (s.nudge_freq = 'weekly' and rl.week_start = wb.week_start)
        or (s.nudge_freq = 'daily' and rl.sent_at >= wb.today_cph)
      )
  );
$$;


ALTER FUNCTION "public"."get_due_reactivation_nudges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_due_reminders"() RETURNS TABLE("kind" "text", "entity_type" "text", "entity_id" "uuid", "user_id" "uuid", "match_id" "uuid", "label" "text", "fmt" "text", "start_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with m as (
    select mt.id, mt.court_name, mt.creator_id, mt.started_at,
      ((mt.date::text || ' ' || coalesce(nullif(mt.time,''),'00:00'))::timestamp
        at time zone 'Europe/Copenhagen') as start_at,
      case when mt.time_end ~ '^\d{1,2}:\d{2}'
        then ((mt.date::text || ' ' || mt.time_end)::timestamp at time zone 'Europe/Copenhagen')
        else ((mt.date::text || ' ' || coalesce(nullif(mt.time,''),'00:00'))::timestamp
              at time zone 'Europe/Copenhagen') + interval '90 minutes'
      end as end_at,
      (select count(*) from match_players mp where mp.match_id = mt.id) as player_count
    from matches mt
    where mt.status in ('open','full','in_progress') and mt.time ~ '^\d{1,2}:\d{2}'
  ),
  match_reminders as (
    select k.kind, 'match'::text as entity_type, m.id as entity_id, mp.user_id,
           m.id as match_id, m.court_name as label, null::text as fmt, m.start_at
    from m
    join match_players mp on mp.match_id = m.id
    cross join lateral (values
      ('reminder_24h', m.start_at between now()+interval '23 hours 45 minutes' and now()+interval '24 hours 15 minutes'),
      ('reminder_1h',  m.start_at between now()+interval '45 minutes' and now()+interval '75 minutes')
    ) as k(kind, due)
    where k.due
      and m.player_count >= 4
  ),
  result_nudges as (
    select 'result_nudge'::text as kind, 'match'::text as entity_type, m.id as entity_id,
           m.creator_id as user_id, m.id as match_id, m.court_name as label, null::text as fmt, m.start_at
    from m
    where m.creator_id is not null
      and m.end_at between now()-interval '2 hours 30 minutes' and now()-interval '1 hour 30 minutes'
      and not exists (select 1 from match_results r where r.match_id = m.id)
      and m.player_count >= 4
      and m.started_at is not null
  ),
  am as (
    select t.id, t.name, t.format, t.player_slots,
      ((t.tournament_date::text || ' ' || substring(t.time_slot from '^\d{1,2}:\d{2}'))::timestamp
        at time zone 'Europe/Copenhagen') as start_at,
      (select count(*) from americano_participants ap where ap.tournament_id = t.id) as participant_count
    from americano_tournaments t
    where t.status not in ('completed','cancelled') and t.time_slot ~ '^\d{1,2}:\d{2}'
  ),
  am_reminders as (
    select k.kind, 'americano'::text as entity_type, am.id as entity_id, ap.user_id,
           null::uuid as match_id, am.name as label, am.format as fmt, am.start_at
    from am
    join americano_participants ap on ap.tournament_id = am.id
    cross join lateral (values
      ('reminder_24h', am.start_at between now()+interval '23 hours 45 minutes' and now()+interval '24 hours 15 minutes'),
      ('reminder_1h',  am.start_at between now()+interval '45 minutes' and now()+interval '75 minutes')
    ) as k(kind, due)
    where k.due
      and am.participant_count >= coalesce(am.player_slots, 4)
  ),
  proposal_deadlines as (
    select 'proposal_deadline'::text as kind,
           'match_proposal'::text as entity_type,
           pr.id as entity_id,
           mem.user_id,
           null::uuid as match_id,
           to_char(pr.play_date, 'DD/MM') || ' kl. ' || to_char(pr.start_time, 'HH24:MI') as label,
           null::text as fmt,
           pr.expires_at as start_at
    from match_proposals pr
    join match_proposal_members mem on mem.proposal_id = pr.id
    where pr.status = 'pending'
      and mem.response = 'pending'
      and pr.expires_at between now() + interval '20 minutes' and now() + interval '3 hours'
      and pr.created_at <= now() - interval '45 minutes'
      and (select count(*) from match_proposal_members mem_all where mem_all.proposal_id = pr.id) >= 4
  ),
  all_due as (
    select * from match_reminders
    union all select * from result_nudges
    union all select * from am_reminders
    union all select * from proposal_deadlines
  )
  select d.kind, d.entity_type, d.entity_id, d.user_id, d.match_id, d.label, d.fmt, d.start_at
  from all_due d
  where d.user_id is not null
    and not exists (
      select 1 from reminder_log rl
      where rl.entity_type = d.entity_type and rl.entity_id = d.entity_id
        and rl.kind = d.kind and rl.user_id = d.user_id
    );
$$;


ALTER FUNCTION "public"."get_due_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_growth_campaign_public"("p_slug" "text" DEFAULT 'first_200'::"text") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_campaign public.growth_campaigns%ROWTYPE;
  v_taken integer;
BEGIN
  SELECT * INTO v_campaign
  FROM public.growth_campaigns
  WHERE slug = p_slug
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  RETURN json_build_object(
    'found', true,
    'slug', v_campaign.slug,
    'title', v_campaign.title,
    'prize_description', v_campaign.prize_description,
    'spots_taken', v_taken,
    'spots_total', v_campaign.max_entries,
    'is_open', v_campaign.status = 'active' AND v_taken < v_campaign.max_entries AND v_campaign.winner_user_id IS NULL,
    'status', v_campaign.status,
    'rules_version', v_campaign.rules_version,
    'draw_completed', v_campaign.winner_user_id IS NOT NULL,
    'draw_at', v_campaign.draw_at
  );
END;
$$;


ALTER FUNCTION "public"."get_growth_campaign_public"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_growth_campaign_status"("p_slug" "text" DEFAULT 'first_200'::"text") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign public.growth_campaigns%ROWTYPE;
  v_entry public.growth_campaign_entries%ROWTYPE;
  v_taken integer;
  v_qualified boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('authenticated', false);
  END IF;

  SELECT * INTO v_campaign FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('authenticated', true, 'found', false);
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  SELECT * INTO v_entry
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id AND user_id = v_uid;

  v_qualified := public._growth_user_qualified(v_uid);

  RETURN json_build_object(
    'authenticated', true,
    'found', true,
    'slug', v_campaign.slug,
    'title', v_campaign.title,
    'prize_description', v_campaign.prize_description,
    'spots_taken', v_taken,
    'spots_total', v_campaign.max_entries,
    'is_open', v_campaign.status = 'active' AND v_taken < v_campaign.max_entries AND v_campaign.winner_user_id IS NULL,
    'status', v_campaign.status,
    'qualified', v_qualified,
    'enrolled', v_entry.id IS NOT NULL,
    'entry_number', v_entry.entry_number,
    'campaign_full', v_taken >= v_campaign.max_entries,
    'draw_completed', v_campaign.winner_user_id IS NOT NULL,
    'is_winner', v_campaign.winner_user_id IS NOT NULL AND v_campaign.winner_user_id = v_uid
  );
END;
$$;


ALTER FUNCTION "public"."get_my_growth_campaign_status"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."glicko2_shadow_update_one"("p_rating" numeric, "p_rd" numeric, "p_volatility" numeric, "p_opp_rating" numeric, "p_opp_rd" numeric, "p_outcome" numeric, "p_tau" numeric DEFAULT 0.5, "p_epsilon" numeric DEFAULT 0.000001) RETURNS TABLE("new_rating" numeric, "new_rd" numeric, "new_volatility" numeric, "expected" numeric, "delta_rating" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_scale constant numeric := 173.7178;

  v_mu numeric;
  v_phi numeric;
  v_sigma numeric;

  v_mu_j numeric;
  v_phi_j numeric;

  v_g numeric;
  v_e numeric;
  v_v numeric;
  v_delta numeric;

  v_a numeric;
  v_a_cur numeric;
  v_b_cur numeric;
  v_c_cur numeric;
  v_f_a numeric;
  v_f_b numeric;
  v_f_c numeric;
  v_exp_x numeric;
  v_k integer := 1;
  v_iter integer := 0;

  v_sigma_prime numeric;
  v_phi_star numeric;
  v_phi_prime numeric;
  v_mu_prime numeric;

  v_delta_sq numeric;
  v_phi_sq numeric;
BEGIN
  v_mu := (COALESCE(p_rating, 1500) - 1500) / v_scale;
  v_phi := GREATEST(COALESCE(p_rd, 350), 30) / v_scale;
  v_sigma := GREATEST(COALESCE(p_volatility, 0.06), 0.000001);

  v_mu_j := (COALESCE(p_opp_rating, 1500) - 1500) / v_scale;
  v_phi_j := GREATEST(COALESCE(p_opp_rd, 350), 30) / v_scale;

  v_g := 1 / sqrt(1 + (3 * power(v_phi_j, 2) / power(pi(), 2)));
  v_e := 1 / (1 + exp(-v_g * (v_mu - v_mu_j)));
  v_v := 1 / (power(v_g, 2) * v_e * (1 - v_e));
  v_delta := v_v * v_g * (COALESCE(p_outcome, 0) - v_e);

  v_a := ln(power(v_sigma, 2));
  v_delta_sq := power(v_delta, 2);
  v_phi_sq := power(v_phi, 2);

  v_a_cur := v_a;

  IF v_delta_sq > (v_phi_sq + v_v) THEN
    v_b_cur := ln(v_delta_sq - v_phi_sq - v_v);
  ELSE
    LOOP
      v_b_cur := v_a - v_k * COALESCE(p_tau, 0.5);
      v_exp_x := exp(v_b_cur);
      v_f_b := (
        v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
        / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
      ) - ((v_b_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

      EXIT WHEN v_f_b >= 0 OR v_k > 100;
      v_k := v_k + 1;
    END LOOP;
  END IF;

  v_exp_x := exp(v_a_cur);
  v_f_a := (
    v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
    / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
  ) - ((v_a_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

  v_exp_x := exp(v_b_cur);
  v_f_b := (
    v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
    / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
  ) - ((v_b_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

  WHILE abs(v_b_cur - v_a_cur) > COALESCE(p_epsilon, 0.000001) AND v_iter < 100 LOOP
    IF abs(v_f_b - v_f_a) < 0.000000000001 THEN
      v_c_cur := (v_a_cur + v_b_cur) / 2;
    ELSE
      v_c_cur := v_a_cur + (v_a_cur - v_b_cur) * v_f_a / (v_f_b - v_f_a);
    END IF;

    v_exp_x := exp(v_c_cur);
    v_f_c := (
      v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
      / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
    ) - ((v_c_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

    IF v_f_c * v_f_b <= 0 THEN
      v_a_cur := v_b_cur;
      v_f_a := v_f_b;
    ELSE
      v_f_a := v_f_a / 2;
    END IF;

    v_b_cur := v_c_cur;
    v_f_b := v_f_c;
    v_iter := v_iter + 1;
  END LOOP;

  v_sigma_prime := exp(v_a_cur / 2);
  v_phi_star := sqrt(v_phi_sq + power(v_sigma_prime, 2));
  v_phi_prime := 1 / sqrt((1 / power(v_phi_star, 2)) + (1 / v_v));
  v_mu_prime := v_mu + power(v_phi_prime, 2) * v_g * (COALESCE(p_outcome, 0) - v_e);

  new_rating := 1500 + v_scale * v_mu_prime;
  new_rd := GREATEST(30, v_scale * v_phi_prime);
  new_volatility := v_sigma_prime;
  expected := v_e;
  delta_rating := (1500 + v_scale * v_mu_prime) - COALESCE(p_rating, 1500);

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."glicko2_shadow_update_one"("p_rating" numeric, "p_rd" numeric, "p_volatility" numeric, "p_opp_rating" numeric, "p_opp_rd" numeric, "p_outcome" numeric, "p_tau" numeric, "p_epsilon" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_americano_complete_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_participants integer := 0;
  v_distinct_participants integer := 0;
  v_matches integer := 0;
  v_invalid_scores integer := 0;
  v_invalid_player_links integer := 0;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    SELECT COUNT(*)::int, COUNT(DISTINCT ap.user_id)::int
    INTO v_participants, v_distinct_participants
    FROM public.americano_participants ap WHERE ap.tournament_id = NEW.id;
    IF v_participants < 4 OR v_participants > 16 THEN
      RAISE EXCEPTION 'Americano kraever mellem 4 og 16 deltagere ved afslutning (fandt %).', v_participants;
    END IF;
    IF v_distinct_participants <> v_participants THEN
      RAISE EXCEPTION 'Americano har duplikerede brugere i deltagerlisten (% unikke af %).', v_distinct_participants, v_participants;
    END IF;
    SELECT COUNT(*)::int INTO v_matches FROM public.americano_matches m WHERE m.tournament_id = NEW.id;
    IF NOT public.americano_match_count_is_valid(v_participants, NEW.opponent_passes, COALESCE(NEW.courts_per_round, 1), v_matches) THEN
      RAISE EXCEPTION 'Forkert antal Americano-kampe ved afslutning. Forventet ca. %–% (eller legacy %), fandt % (deltagere: %, baner: %, passes: %).',
        public.americano_round_robin_base_rounds(v_participants, COALESCE(NEW.courts_per_round, 1)) * CASE WHEN COALESCE(NEW.opponent_passes, 1) = 2 THEN 2 ELSE 1 END,
        (public.americano_round_robin_base_rounds(v_participants, COALESCE(NEW.courts_per_round, 1)) + v_participants * 4) * CASE WHEN COALESCE(NEW.opponent_passes, 1) = 2 THEN 2 ELSE 1 END,
        COALESCE(public.expected_americano_match_count_legacy(v_participants, NEW.opponent_passes), -1),
        COALESCE(v_matches, 0), v_participants, COALESCE(NEW.courts_per_round, 1), COALESCE(NEW.opponent_passes, 1);
    END IF;
    SELECT COUNT(*)::int INTO v_invalid_scores FROM public.americano_matches m WHERE m.tournament_id = NEW.id AND (m.team_a_score IS NULL OR m.team_b_score IS NULL OR (m.team_a_score + m.team_b_score) <> NEW.points_per_match);
    IF v_invalid_scores > 0 THEN RAISE EXCEPTION 'Americano kan ikke afsluttes: % kamp(e) har ugyldig score ift. points_per_match=%.', v_invalid_scores, COALESCE(NEW.points_per_match, 0); END IF;
    SELECT COUNT(*)::int INTO v_invalid_player_links FROM public.americano_matches m
    LEFT JOIN public.americano_participants a1 ON a1.id = m.team_a_p1 AND a1.tournament_id = m.tournament_id
    LEFT JOIN public.americano_participants a2 ON a2.id = m.team_a_p2 AND a2.tournament_id = m.tournament_id
    LEFT JOIN public.americano_participants b1 ON b1.id = m.team_b_p1 AND b1.tournament_id = m.tournament_id
    LEFT JOIN public.americano_participants b2 ON b2.id = m.team_b_p2 AND b2.tournament_id = m.tournament_id
    WHERE m.tournament_id = NEW.id AND (a1.id IS NULL OR a2.id IS NULL OR b1.id IS NULL OR b2.id IS NULL);
    IF v_invalid_player_links > 0 THEN RAISE EXCEPTION 'Americano kan ikke afsluttes: % kamp(e) refererer til ugyldige deltagere.', v_invalid_player_links; END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_americano_complete_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_americano_participant_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_status text;
  v_slots integer;
  v_date date;
  v_count integer;
BEGIN
  SELECT t.status, t.player_slots, t.tournament_date
    INTO v_status, v_slots, v_date
  FROM public.americano_tournaments t
  WHERE t.id = NEW.tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tournament_not_found';
  END IF;

  IF lower(coalesce(v_status, '')) <> 'registration'
     OR v_date < (timezone('Europe/Copenhagen', now()))::date THEN
    RAISE EXCEPTION 'tournament_not_open';
  END IF;

  SELECT count(*)::integer
    INTO v_count
  FROM public.americano_participants
  WHERE tournament_id = NEW.tournament_id;

  IF v_slots IS NOT NULL AND v_count >= v_slots THEN
    RAISE EXCEPTION 'tournament_full';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_americano_participant_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_match_result_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid            uuid := auth.uid();
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

  IF NOT public.can_confirm_match_result(OLD.match_id, OLD.submitted_by, v_uid) THEN
    RAISE EXCEPTION 'Result must be confirmed by an opposing team player or admin';
  END IF;

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


ALTER FUNCTION "public"."guard_match_result_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_matches_client_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER-funktioner kører som ejeren og skal kunne alt.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
    RAISE EXCEPTION 'Kampens opretter kan ikke ændres';
  END IF;

  -- En afsluttet kamp har fået ELO tildelt og er lukket for klient-skrivninger.
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Afsluttet kamp kan ikke ændres';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('completed', 'cancelled')
     AND auth.uid() IS DISTINCT FROM OLD.creator_id THEN
    RAISE EXCEPTION 'Kun kampens opretter kan afslutte eller aflyse kampen';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_matches_client_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
  v_name  text;
  v_phone text;
BEGIN
  v_phone := NULLIF(TRIM(NEW.phone), '');

  v_email := LOWER(TRIM(COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'pending_email',
    NEW.raw_user_meta_data->>'email'
  )));

  IF v_email IS NULL OR v_email = '' THEN
    IF v_phone IS NOT NULL THEN
      v_email := regexp_replace(v_phone, '[^0-9+]', '', 'g') || '@phone.local';
    ELSE
      v_email := 'user+' || NEW.id::text || '@local.invalid';
    END IF;
  END IF;

  v_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  )), '');

  IF v_name IS NULL THEN
    v_name := split_part(v_email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, email, name, full_name)
  VALUES (NEW.id, v_email, v_name, v_name)
  ON CONFLICT (id) DO UPDATE
  SET
    email     = COALESCE(NULLIF(profiles.email, ''), EXCLUDED.email),
    name      = COALESCE(NULLIF(profiles.name, ''), EXCLUDED.name),
    full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name);

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Signup må ikke fejle pga profil-trigger
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_admin_role"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND lower(COALESCE(p.role, '')) = 'admin'
  );
$$;


ALTER FUNCTION "public"."has_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_valid_match_result_confirmation"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN RETURN false; END IF;
  IF public.is_user_admin_verified(p_confirmed_by) THEN RETURN true; END IF;
  RETURN public.can_confirm_match_result(p_match_id, p_submitted_by, p_confirmed_by);
END; $$;


ALTER FUNCTION "public"."has_valid_match_result_confirmation"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."haversine_km"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 6371.0 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  end;
$$;


ALTER FUNCTION "public"."haversine_km"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_role boolean := false;
  v_pin_verified boolean := false;
  v_iat bigint;
  v_max_admin_jwt_seconds constant integer := 8 * 3600;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT public.has_admin_role() INTO v_has_role;
  IF NOT COALESCE(v_has_role, false) THEN RETURN false; END IF;
  v_iat := NULLIF(auth.jwt() ->> 'iat', '')::bigint;
  IF v_iat IS NULL OR (extract(epoch FROM now())::bigint - v_iat) > v_max_admin_jwt_seconds THEN RETURN false; END IF;
  IF to_regclass('public.admin_pin_sessions') IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.admin_pin_sessions s WHERE s.user_id = v_uid AND s.verified_until > now()) INTO v_pin_verified;
  RETURN COALESCE(v_pin_verified, false);
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_banned"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_banned = true
  );
END;
$$;


ALTER FUNCTION "public"."is_banned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_league_participant"("p_league_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_teams lt
    WHERE lt.league_id = p_league_id
      AND (lt.player1_id = auth.uid() OR lt.player2_id = auth.uid())
  )
  OR COALESCE(public.is_admin(), false);
$$;


ALTER FUNCTION "public"."is_league_participant"("p_league_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_admin_verified"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_is_admin boolean := false;
  v_pin_verified boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND lower(COALESCE(p.role, '')) = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN false;
  END IF;

  IF to_regclass('public.admin_pin_sessions') IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admin_pin_sessions s
    WHERE s.user_id = p_user_id
      AND s.verified_until > now()
  ) INTO v_pin_verified;

  RETURN COALESCE(v_pin_verified, false);
END;
$$;


ALTER FUNCTION "public"."is_user_admin_verified"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text" DEFAULT NULL::"text", "p_user_email" "text" DEFAULT NULL::"text", "p_user_emoji" "text" DEFAULT '🎾'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid;
  v_count int;
  v_t1 int;
  v_t2 int;
  v_max int;
  v_status text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;

  SELECT status, max_players INTO v_status, v_max
  FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('error', 'Kampen er ikke åben for tilmelding');
  END IF;

  IF EXISTS (SELECT 1 FROM match_players WHERE match_id = p_match_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('error', 'Du er allerede tilmeldt');
  END IF;

  SELECT COUNT(*) INTO v_count FROM match_players WHERE match_id = p_match_id;
  IF v_count >= COALESCE(v_max, 4) THEN
    RETURN jsonb_build_object('error', 'Kampen er fuld');
  END IF;

  INSERT INTO match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, v_uid, p_user_name, p_user_email, p_user_emoji, p_team);

  SELECT COUNT(*) INTO v_count FROM match_players WHERE match_id = p_match_id;
  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;

  UPDATE matches SET
    current_players = v_count,
    status = CASE WHEN v_t1 >= 2 AND v_t2 >= 2 THEN 'full' ELSE 'open' END
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'current_players', v_count,
    'status', CASE WHEN v_t1 >= 2 AND v_t2 >= 2 THEN 'full' ELSE 'open' END
  );
END;
$$;


ALTER FUNCTION "public"."join_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_open_match"("p_match_id" "uuid", "p_team" integer DEFAULT NULL::integer, "p_user_name" "text" DEFAULT NULL::"text", "p_user_email" "text" DEFAULT NULL::"text", "p_user_emoji" "text" DEFAULT '🎾'::"text", "p_court_side" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_match_type text;
  v_status text;
  v_t1 int;
  v_t2 int;
  v_total int;
  v_team int;
  v_name text;
  v_pref text;
  v_wanted text;
  v_side text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF public.is_banned() THEN
    RETURN jsonb_build_object('success', false, 'error', 'banned');
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('join_open_match', 60, 3600);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    SELECT mp.team INTO v_team
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller;
    RETURN jsonb_build_object('success', true, 'already_joined', true, 'team', v_team);
  END IF;

  SELECT lower(coalesce(m.match_type, 'open')), lower(coalesce(m.status, 'open'))
  INTO v_match_type, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_match_type = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_closed');
  END IF;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  SELECT COUNT(*) FILTER (WHERE team = 1),
         COUNT(*) FILTER (WHERE team = 2),
         COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_total >= 4 OR (v_t1 >= 2 AND v_t2 >= 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_full');
  END IF;

  IF p_team IS NOT NULL THEN
    IF p_team NOT IN (1, 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_team');
    END IF;
    v_team := p_team;
    IF (v_team = 1 AND v_t1 >= 2) OR (v_team = 2 AND v_t2 >= 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team);
    END IF;
  ELSE
    v_team := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;
    IF (v_team = 1 AND v_t1 >= 2) OR (v_team = 2 AND v_t2 >= 2) THEN
      v_team := CASE WHEN v_team = 1 THEN 2 ELSE 1 END;
    END IF;
    IF (v_team = 1 AND v_t1 >= 2) OR (v_team = 2 AND v_t2 >= 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team);
    END IF;
  END IF;

  v_name := nullif(btrim(coalesce(p_user_name, '')), '');
  IF v_name IS NULL THEN
    SELECT coalesce(nullif(btrim(full_name), ''), nullif(btrim(name), ''), 'Spiller')
    INTO v_name
    FROM public.profiles
    WHERE id = v_caller;
  END IF;

  SELECT CASE
    WHEN lower(coalesce(p.court_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p.court_side, '')) LIKE '%højre%'
      OR lower(coalesce(p.court_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END
  INTO v_pref
  FROM public.profiles p
  WHERE p.id = v_caller;

  v_wanted := CASE
    WHEN p_court_side IN ('left', 'right') THEN p_court_side
    WHEN lower(coalesce(p_court_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p_court_side, '')) LIKE '%højre%'
      OR lower(coalesce(p_court_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END;

  v_side := public.match_players_free_court_side(
    p_match_id,
    v_team,
    NULL,
    coalesce(v_wanted, v_pref)
  );

  BEGIN
    INSERT INTO public.match_players (match_id, user_id, user_name, user_email, user_emoji, team, court_side)
    VALUES (
      p_match_id,
      v_caller,
      coalesce(v_name, 'Spiller'),
      nullif(btrim(coalesce(p_user_email, '')), ''),
      coalesce(nullif(btrim(p_user_emoji), ''), '🎾'),
      v_team,
      v_side
    )
    ON CONFLICT ON CONSTRAINT match_players_match_id_user_id_key DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      IF EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
      ) THEN
        RETURN jsonb_build_object('success', true, 'already_joined', true, 'team', v_team);
      END IF;
      RETURN jsonb_build_object('success', false, 'error', 'insert_failed');
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'insert_failed');
  END IF;

  SELECT COUNT(*) FILTER (WHERE team = 1),
         COUNT(*) FILTER (WHERE team = 2),
         COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_t1 > 2 OR v_t2 > 2 THEN
    DELETE FROM public.match_players
    WHERE match_id = p_match_id AND user_id = v_caller;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team);
  END IF;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE public.matches
    SET status = 'full', current_players = v_total, seeking_player = false
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches
    SET status = 'open', current_players = v_total
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'team', v_team,
    'court_side', v_side,
    'is_full', (v_t1 >= 2 AND v_t2 >= 2),
    'current_players', v_total
  );
END;
$$;


ALTER FUNCTION "public"."join_open_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text", "p_court_side" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kampe_unread_badge_count"() RETURNS integer
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match_count integer := 0;
  v_entity_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*)::int INTO v_match_count
  FROM public.notifications n
  JOIN public.matches m ON m.id = n.match_id
  WHERE n.user_id = v_uid
    AND n.read = false
    AND n.type <> 'match_invite'
    AND (
      m.creator_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = m.id AND mp.user_id = v_uid
      )
    )
    AND (
      n.type = 'match_chat'
      OR (lower(coalesce(m.status, 'open')) IN ('open', 'full')
          AND n.type IN ('match_join', 'match_full', 'match_cancelled', 'seeking_player'))
      OR (lower(coalesce(m.status, 'open')) = 'in_progress'
          AND n.type IN ('result_submitted', 'match_cancelled'))
      OR (lower(coalesce(m.status, 'open')) = 'completed'
          AND n.type = 'result_confirmed')
    );

  SELECT count(*)::int INTO v_entity_count
  FROM public.notifications n
  WHERE n.user_id = v_uid
    AND n.read = false
    AND n.entity_id IS NOT NULL
    AND n.type IN (
      'americano_invite', 'americano_full', 'americano_started', 'americano_completed',
      'americano_spot_open', 'americano_cancelled', 'league_full', 'league_started',
      'league_completed', 'team_invite', 'team_invite_accepted', 'team_invite_declined'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.americano_participants ap
        WHERE ap.tournament_id = n.entity_id AND ap.user_id = v_uid
      )
      OR EXISTS (
        SELECT 1 FROM public.league_teams lt
        WHERE lt.league_id = n.entity_id
          AND (lt.player1_id = v_uid OR lt.player2_id = v_uid)
      )
      OR EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = n.entity_id AND l.created_by = v_uid
      )
    );

  RETURN v_match_count + v_entity_count;
END;
$$;


ALTER FUNCTION "public"."kampe_unread_badge_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kick_player_from_match"("p_match_id" "uuid", "p_target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_creator_id uuid;
  v_status text;
  v_remaining int;
  v_new_creator uuid;
  v_was_creator boolean;
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_is_admin := COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false);

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_locked');
  END IF;

  IF v_creator_id IS DISTINCT FROM v_caller AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_allowed');
  END IF;

  IF p_target_user_id = v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_kick_self');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = p_target_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_match');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (
    p_target_user_id,
    'match_cancelled',
    'Du er fjernet fra kampen ❌',
    'En admin/opretter har fjernet dig fra kampen.',
    p_match_id,
    false
  );

  v_was_creator := (v_creator_id = p_target_user_id);

  DELETE FROM public.match_players
  WHERE match_id = p_match_id AND user_id = p_target_user_id;

  SELECT COUNT(*) INTO v_remaining
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_remaining = 0 THEN
    UPDATE public.matches
    SET status = 'cancelled', current_players = 0, seeking_player = false
    WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'cancelled', true, 'remaining', 0);
  END IF;

  v_new_creator := v_creator_id;
  IF v_was_creator THEN
    SELECT mp.user_id INTO v_new_creator
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
    ORDER BY mp.user_id
    LIMIT 1;
  END IF;

  UPDATE public.matches
  SET creator_id = v_new_creator,
      status = 'open',
      current_players = v_remaining,
      seeking_player = false
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled', false,
    'remaining', v_remaining,
    'creator_transferred', v_was_creator,
    'new_creator_id', v_new_creator
  );
END;
$$;


ALTER FUNCTION "public"."kick_player_from_match"("p_match_id" "uuid", "p_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."league_team_messages_set_league_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  SELECT lt.league_id INTO NEW.league_id
  FROM public.league_teams lt
  WHERE lt.id = NEW.team_id;

  IF NEW.league_id IS NULL THEN
    RAISE EXCEPTION 'Ugyldigt hold';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."league_team_messages_set_league_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_match"("p_match_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_creator_id uuid;
  v_status text;
  v_remaining int;
  v_new_creator uuid;
  v_was_creator boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_locked');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_match');
  END IF;

  v_was_creator := (v_creator_id = v_caller);

  DELETE FROM public.match_players
  WHERE match_id = p_match_id AND user_id = v_caller;

  SELECT COUNT(*) INTO v_remaining
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_remaining = 0 THEN
    UPDATE public.matches
    SET status = 'cancelled', current_players = 0, seeking_player = false
    WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'cancelled', true, 'remaining', 0);
  END IF;

  IF v_was_creator THEN
    SELECT mp.user_id
    INTO v_new_creator
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
    ORDER BY mp.user_id
    LIMIT 1;

    UPDATE public.matches
    SET creator_id = v_new_creator,
        status = 'open',
        current_players = v_remaining,
        seeking_player = false
    WHERE id = p_match_id;

    RETURN jsonb_build_object(
      'success', true,
      'cancelled', false,
      'remaining', v_remaining,
      'creator_transferred', true,
      'new_creator_id', v_new_creator
    );
  END IF;

  UPDATE public.matches
  SET status = 'open', current_players = v_remaining
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled', false,
    'remaining', v_remaining,
    'creator_transferred', false
  );
END;
$$;


ALTER FUNCTION "public"."leave_match"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_dm_conversation_summaries"("p_scan_limit" integer DEFAULT 800) RETURNS TABLE("other_user_id" "uuid", "last_message_id" "uuid", "last_sender_id" "uuid", "last_receiver_id" "uuid", "last_content" "text", "last_created_at" timestamp with time zone, "last_is_read" boolean, "unread_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE v_caller uuid; v_limit integer; BEGIN v_caller := (SELECT auth.uid()); IF v_caller IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF; v_limit := GREATEST(50, LEAST(coalesce(p_scan_limit, 800), 2000)); RETURN QUERY WITH scoped AS (SELECT m.id, m.sender_id, m.receiver_id, public.dm_message_preview(m.message_type, m.content, m.payload) AS content, m.created_at, m.is_read FROM public.messages m WHERE (m.sender_id = v_caller OR m.receiver_id = v_caller) AND NOT public.dm_users_blocked(v_caller, CASE WHEN m.sender_id = v_caller THEN m.receiver_id ELSE m.sender_id END) ORDER BY m.created_at DESC LIMIT v_limit), latest AS (SELECT DISTINCT ON (CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END) CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END AS other_user_id, s.id AS last_message_id, s.sender_id AS last_sender_id, s.receiver_id AS last_receiver_id, s.content AS last_content, s.created_at AS last_created_at, s.is_read AS last_is_read FROM scoped s ORDER BY CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END, s.created_at DESC) SELECT l.other_user_id, l.last_message_id, l.last_sender_id, l.last_receiver_id, l.last_content, l.last_created_at, l.last_is_read, (SELECT count(*)::bigint FROM scoped u WHERE u.receiver_id = v_caller AND u.sender_id = l.other_user_id AND u.is_read = false) AS unread_count FROM latest l ORDER BY l.last_created_at DESC; END; $$;


ALTER FUNCTION "public"."list_dm_conversation_summaries"("p_scan_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_pending_match_proposals"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x))
    FROM (
      SELECT
        p.id,
        p.play_date,
        p.start_time,
        p.end_time,
        p.region,
        p.status,
        p.expires_at,
        (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', m.user_id,
            'name', COALESCE(NULLIF(btrim(pr.full_name), ''), NULLIF(btrim(pr.name), ''), 'Spiller'),
            'avatar', COALESCE(NULLIF(btrim(pr.avatar), ''), NULLIF(btrim(pr.avatar_emoji), ''), '🎾'),
            'level', pr.level,
            'response', m.response,
            'is_me', m.user_id = v_caller
          ) ORDER BY (m.user_id = v_caller) DESC, lower(COALESCE(pr.full_name, pr.name, ''))), '[]'::jsonb)
          FROM public.match_proposal_members m
          JOIN public.profiles pr ON pr.id = m.user_id
          WHERE m.proposal_id = p.id
        ) AS members
      FROM public.match_proposals p
      JOIN public.match_proposal_members mine
        ON mine.proposal_id = p.id AND mine.user_id = v_caller
      WHERE p.status = 'pending'
        AND p.expires_at > now()
        AND mine.response IN ('pending', 'accepted')
      ORDER BY p.expires_at
    ) x
  ), '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."list_pending_match_proposals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_feed_is_active"("p_prefs" "jsonb", "p_seeking_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF COALESCE((p_prefs->>'feedVisible')::boolean, false) IS NOT TRUE THEN
    RETURN false;
  END IF;
  BEGIN
    v_since := NULLIF(btrim(COALESCE(p_prefs->>'feedVisibleSince', '')), '')::timestamptz;
  EXCEPTION
    WHEN OTHERS THEN
      v_since := NULL;
  END;
  v_since := COALESCE(v_since, p_seeking_at);
  IF v_since IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_since >= (now() - interval '7 days');
END;
$$;


ALTER FUNCTION "public"."makker_feed_is_active"("p_prefs" "jsonb", "p_seeking_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_availability_overlap"("p_filter" "jsonb", "p_subject" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_filter IS NULL OR jsonb_array_length(p_filter) = 0 THEN true
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_filter) AS f(slot)
      WHERE lower(trim(f.slot)) = 'flexibel'
    ) THEN true
    WHEN p_subject IS NULL OR array_length(p_subject, 1) IS NULL OR array_length(p_subject, 1) = 0 THEN true
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_filter) AS f(slot)
      WHERE lower(trim(f.slot)) = ANY (
        SELECT lower(trim(x)) FROM unnest(p_subject) AS x
      )
    )
  END;
$$;


ALTER FUNCTION "public"."makker_filter_availability_overlap"("p_filter" "jsonb", "p_subject" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_court_side_ok"("p_mode" "text", "p_watcher_side" "text", "p_subject_side" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE COALESCE(NULLIF(trim(p_mode), ''), 'complementary')
    WHEN 'any' THEN true
    WHEN 'complementary' THEN (
      (public.makker_filter_normalize_side(p_watcher_side) = 'venstre'
        AND public.makker_filter_normalize_side(p_subject_side) = 'hojre')
      OR (public.makker_filter_normalize_side(p_watcher_side) = 'hojre'
        AND public.makker_filter_normalize_side(p_subject_side) = 'venstre')
      OR public.makker_filter_normalize_side(p_watcher_side) = 'begge'
      OR public.makker_filter_normalize_side(p_subject_side) = 'begge'
    )
    WHEN 'same' THEN (
      public.makker_filter_normalize_side(p_watcher_side) <> ''
      AND public.makker_filter_normalize_side(p_watcher_side) = public.makker_filter_normalize_side(p_subject_side)
    )
    ELSE true
  END;
$$;


ALTER FUNCTION "public"."makker_filter_court_side_ok"("p_mode" "text", "p_watcher_side" "text", "p_subject_side" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_intent_compat_score"("p_a" "text", "p_b" "text") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE public.makker_filter_normalize_intent(p_a)
    WHEN 'konkurrence' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 1.0 WHEN 'traening' THEN 0.6 WHEN 'hygge' THEN 0.2
      WHEN 'fast_makker' THEN 0.5 WHEN 'turnering' THEN 0.8 ELSE 0.4 END
    WHEN 'traening' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.6 WHEN 'traening' THEN 1.0 WHEN 'hygge' THEN 0.5
      WHEN 'fast_makker' THEN 0.7 WHEN 'turnering' THEN 0.5 ELSE 0.4 END
    WHEN 'hygge' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.2 WHEN 'traening' THEN 0.5 WHEN 'hygge' THEN 1.0
      WHEN 'fast_makker' THEN 0.8 WHEN 'turnering' THEN 0.3 ELSE 0.4 END
    WHEN 'fast_makker' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.5 WHEN 'traening' THEN 0.7 WHEN 'hygge' THEN 0.8
      WHEN 'fast_makker' THEN 1.0 WHEN 'turnering' THEN 0.4 ELSE 0.4 END
    WHEN 'turnering' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.8 WHEN 'traening' THEN 0.5 WHEN 'hygge' THEN 0.3
      WHEN 'fast_makker' THEN 0.4 WHEN 'turnering' THEN 1.0 ELSE 0.4 END
    ELSE 0.4
  END;
$$;


ALTER FUNCTION "public"."makker_filter_intent_compat_score"("p_a" "text", "p_b" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_intent_ok"("p_intents" "jsonb", "p_mode" "text", "p_subject_intent" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN p_intents IS NULL OR jsonb_array_length(p_intents) = 0 THEN true
    WHEN NULLIF(trim(coalesce(p_subject_intent, '')), '') IS NULL THEN true
    WHEN COALESCE(NULLIF(trim(p_mode), ''), 'compatible') = 'exact' THEN
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(p_intents) AS i(key)
        WHERE public.makker_filter_normalize_intent(i.key)
          = public.makker_filter_normalize_intent(p_subject_intent)
      )
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_intents) AS i(key)
      WHERE public.makker_filter_intent_compat_score(i.key, p_subject_intent) >= 0.6
    )
  END;
$$;


ALTER FUNCTION "public"."makker_filter_intent_ok"("p_intents" "jsonb", "p_mode" "text", "p_subject_intent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_level_bounds"("p_prefs" "jsonb", "p_watcher_level" numeric) RETURNS TABLE("level_min" numeric, "level_max" numeric)
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    CASE COALESCE(NULLIF(trim(p_prefs->>'partnerLevel'), ''), '')
      WHEN 'wide' THEN 1.0
      WHEN 'stronger' THEN GREATEST(1.0, public.match_filter_prefs_level(p_prefs, p_watcher_level))
      WHEN 'weaker' THEN GREATEST(1.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        - public.match_filter_level_window_from_prefs(p_prefs) - 0.15)
      ELSE GREATEST(1.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        - public.match_filter_level_window_from_prefs(p_prefs))
    END AS level_min,
    CASE COALESCE(NULLIF(trim(p_prefs->>'partnerLevel'), ''), '')
      WHEN 'wide' THEN 7.0
      WHEN 'stronger' THEN LEAST(7.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        + public.match_filter_level_window_from_prefs(p_prefs) + 0.15)
      WHEN 'weaker' THEN LEAST(7.0, public.match_filter_prefs_level(p_prefs, p_watcher_level))
      ELSE LEAST(7.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        + public.match_filter_level_window_from_prefs(p_prefs))
    END AS level_max;
$$;


ALTER FUNCTION "public"."makker_filter_level_bounds"("p_prefs" "jsonb", "p_watcher_level" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_normalize_intent"("p_intent" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN lower(coalesce(p_intent, '')) LIKE '%konkurrence%' THEN 'konkurrence'
    WHEN lower(coalesce(p_intent, '')) LIKE '%træning%' OR lower(coalesce(p_intent, '')) LIKE '%traening%' THEN 'traening'
    WHEN lower(coalesce(p_intent, '')) LIKE '%hygge%' THEN 'hygge'
    WHEN lower(coalesce(p_intent, '')) LIKE '%fast%' THEN 'fast_makker'
    WHEN lower(coalesce(p_intent, '')) LIKE '%turnering%' THEN 'turnering'
    ELSE lower(trim(coalesce(p_intent, '')))
  END;
$$;


ALTER FUNCTION "public"."makker_filter_normalize_intent"("p_intent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_normalize_side"("p_side" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN lower(coalesce(p_side, '')) LIKE '%venstre%' THEN 'venstre'
    WHEN lower(coalesce(p_side, '')) LIKE '%højre%' OR lower(coalesce(p_side, '')) LIKE '%hojre%' THEN 'hojre'
    WHEN lower(coalesce(p_side, '')) LIKE '%begge%' THEN 'begge'
    ELSE ''
  END;
$$;


ALTER FUNCTION "public"."makker_filter_normalize_side"("p_side" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_partner_court_side_ok"("p_prefs" "jsonb", "p_watcher_court_side" "text", "p_subject_court_side" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE public.makker_filter_resolve_partner_court_side(p_prefs, p_watcher_court_side)
    WHEN 'any' THEN true
    ELSE (
      public.makker_filter_normalize_side(p_subject_court_side) = ''
      OR public.makker_filter_normalize_side(p_subject_court_side) = 'begge'
      OR public.makker_filter_normalize_side(p_subject_court_side)
        = public.makker_filter_resolve_partner_court_side(p_prefs, p_watcher_court_side)
    )
  END;
$$;


ALTER FUNCTION "public"."makker_filter_partner_court_side_ok"("p_prefs" "jsonb", "p_watcher_court_side" "text", "p_subject_court_side" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_play_style_ok"("p_filter_style" "text", "p_subject_style" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    COALESCE(NULLIF(trim(p_filter_style), ''), 'all') = 'all'
    OR NULLIF(trim(coalesce(p_subject_style, '')), '') IS NULL
    OR trim(p_subject_style) = 'Ved ikke endnu'
    OR trim(p_subject_style) = trim(p_filter_style);
$$;


ALTER FUNCTION "public"."makker_filter_play_style_ok"("p_filter_style" "text", "p_subject_style" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."makker_filter_resolve_partner_court_side"("p_prefs" "jsonb", "p_watcher_court_side" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN NULLIF(trim(p_prefs->>'partnerCourtSide'), '') IN ('venstre', 'hojre', 'any')
      THEN trim(p_prefs->>'partnerCourtSide')
    WHEN COALESCE(NULLIF(trim(p_prefs->>'courtSideMode'), ''), 'complementary') = 'any' THEN 'any'
    WHEN trim(p_prefs->>'courtSideMode') = 'same' THEN
      CASE public.makker_filter_normalize_side(p_watcher_court_side)
        WHEN 'venstre' THEN 'venstre'
        WHEN 'hojre' THEN 'hojre'
        ELSE 'any'
      END
    WHEN public.makker_filter_normalize_side(p_watcher_court_side) = 'venstre' THEN 'hojre'
    WHEN public.makker_filter_normalize_side(p_watcher_court_side) = 'hojre' THEN 'venstre'
    ELSE 'any'
  END;
$$;


ALTER FUNCTION "public"."makker_filter_resolve_partner_court_side"("p_prefs" "jsonb", "p_watcher_court_side" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_filter_level_window_from_prefs"("p_prefs" "jsonb") RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT GREATEST(0.1, LEAST(0.5,
    COALESCE(
      NULLIF(trim(p_prefs->>'levelWindow'), '')::numeric,
      CASE
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 175 THEN 0.2
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 275 THEN 0.3
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 350 THEN 0.4
        ELSE 0.5
      END,
      0.2
    )
  ));
$$;


ALTER FUNCTION "public"."match_filter_level_window_from_prefs"("p_prefs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_filter_prefs_level"("p_prefs" "jsonb", "p_profile_level" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT GREATEST(1.0, LEAST(7.0,
    COALESCE(
      NULLIF(p_profile_level, 0),
      NULLIF(trim(p_prefs->>'myLevel'), '')::numeric,
      3.0
    )
  ));
$$;


ALTER FUNCTION "public"."match_filter_prefs_level"("p_prefs" "jsonb", "p_profile_level" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_players_fill_court_side"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_pref text;
  v_free text;
BEGIN
  IF NEW.team IS NULL OR NEW.team NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.team IS DISTINCT FROM OLD.team
     AND NEW.court_side IS NOT DISTINCT FROM OLD.court_side THEN
    NEW.court_side := NULL;
  END IF;

  SELECT CASE
    WHEN lower(coalesce(p.court_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p.court_side, '')) LIKE '%højre%'
      OR lower(coalesce(p.court_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END
  INTO v_pref
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NEW.court_side IN ('left', 'right') THEN
    v_free := public.match_players_free_court_side(NEW.match_id, NEW.team, NEW.id, NEW.court_side);
    IF v_free IS NULL THEN
      NEW.court_side := NULL;
    ELSIF v_free <> NEW.court_side THEN
      NEW.court_side := v_free;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.team IS DISTINCT FROM OLD.team) THEN
    NEW.court_side := public.match_players_free_court_side(NEW.match_id, NEW.team, NEW.id, v_pref);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."match_players_fill_court_side"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_players_free_court_side"("p_match_id" "uuid", "p_team" integer, "p_exclude_id" "uuid", "p_preferred" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_has_left boolean;
  v_has_right boolean;
  v_pref text;
BEGIN
  v_pref := CASE
    WHEN p_preferred IN ('left', 'right') THEN p_preferred
    ELSE NULL
  END;

  SELECT
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id
        AND mp.team = p_team
        AND mp.court_side = 'left'
        AND mp.id IS DISTINCT FROM p_exclude_id
    ),
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id
        AND mp.team = p_team
        AND mp.court_side = 'right'
        AND mp.id IS DISTINCT FROM p_exclude_id
    )
  INTO v_has_left, v_has_right;

  IF v_pref = 'left' AND NOT v_has_left THEN RETURN 'left'; END IF;
  IF v_pref = 'right' AND NOT v_has_right THEN RETURN 'right'; END IF;
  IF NOT v_has_left THEN RETURN 'left'; END IF;
  IF NOT v_has_right THEN RETURN 'right'; END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."match_players_free_court_side"("p_match_id" "uuid", "p_team" integer, "p_exclude_id" "uuid", "p_preferred" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."messages_enforce_dm_block"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF public.dm_users_blocked(NEW.sender_id, NEW.receiver_id) THEN
    RAISE EXCEPTION 'Du kan ikke sende beskeder til denne spiller (blokeret).'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.sender_id AND is_banned = true) THEN
    RAISE EXCEPTION 'Din konto er begrænset.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."messages_enforce_dm_block"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notifications_dispatch_match_proposal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  IF NEW.type = 'match_proposal' THEN
    PERFORM public.dispatch_push_to_user(
      NEW.user_id,
      NEW.title,
      NEW.body,
      NEW.type,
      NEW.entity_type,
      NEW.entity_id
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notifications_dispatch_match_proposal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_auto_confirmed_match_result"("p_match_id" "uuid", "p_score_text" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_player_id uuid;
  v_count integer := 0;
  v_body text;
BEGIN
  v_body := coalesce(nullif(trim(p_score_text), ''), 'Resultatet');
  v_body := v_body || ' — automatisk bekræftet efter 24 timer uden svar.';

  FOR v_player_id IN
    SELECT mp.user_id FROM public.match_players mp WHERE mp.match_id = p_match_id
  LOOP
    IF public._skip_duplicate_match_notification(v_player_id, 'result_confirmed', p_match_id, 24) THEN
      CONTINUE;
    END IF;
    PERFORM public._insert_system_notification(
      v_player_id,
      'result_confirmed',
      'Resultat bekræftet (auto)',
      v_body,
      p_match_id,
      NULL,
      NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."notify_auto_confirmed_match_result"("p_match_id" "uuid", "p_score_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_creator_join_request"("p_match_id" "uuid", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller  uuid;
  v_creator uuid;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT creator_id INTO v_creator
  FROM public.matches
  WHERE id = p_match_id;

  IF v_creator IS NULL THEN
    RETURN;
  END IF;

  IF v_creator = v_caller THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_join_requests r
    WHERE r.match_id = p_match_id
      AND r.user_id = v_caller
      AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ingen gyldig pending anmodning for denne kamp';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_invite', p_title, p_body, p_match_id, false);
END;
$$;


ALTER FUNCTION "public"."notify_creator_join_request"("p_match_id" "uuid", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_elo_changes_for_match"("p_match_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT eh.user_id, eh.change, eh.old_rating, eh.new_rating
    FROM public.elo_history eh
    WHERE eh.match_id = p_match_id
      AND eh.created_at > now() - interval '2 minutes'
  LOOP
    IF public._skip_duplicate_match_notification(v_row.user_id, 'elo_change', p_match_id, 24) THEN
      CONTINUE;
    END IF;
    PERFORM public._insert_system_notification(
      v_row.user_id,
      'elo_change',
      'ELO opdateret',
      format(
        '%s point (%s → %s). Se din profil eller kampen under Kampe.',
        CASE WHEN v_row.change >= 0 THEN '+' || v_row.change::text ELSE v_row.change::text END,
        v_row.old_rating,
        v_row.new_rating
      ),
      p_match_id,
      NULL,
      NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."notify_elo_changes_for_match"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_league_invite"("p_user_id" "uuid", "p_league_id" "uuid", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.league_teams lt
    WHERE lt.league_id = p_league_id
      AND lt.player1_id = v_caller
      AND lt.player2_id = p_user_id
      AND lt.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ingen adgang til at sende ligainvitation til denne bruger';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, read)
  VALUES (p_user_id, 'team_invite', p_title, p_body, 'league', p_league_id, false);
END;
$$;


ALTER FUNCTION "public"."notify_league_invite"("p_user_id" "uuid", "p_league_id" "uuid", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_league_invite_accepted"("p_team_id" "uuid", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid;
  v_player1 uuid;
  v_league_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT lt.player1_id, lt.league_id INTO v_player1, v_league_id
  FROM public.league_teams lt
  WHERE lt.id = p_team_id AND lt.player2_id = v_caller;

  IF v_player1 IS NULL OR v_league_id IS NULL THEN
    RAISE EXCEPTION 'Ingen adgang: du er ikke player2 på dette hold';
  END IF;

  IF v_player1 = v_caller THEN
    RETURN;
  END IF;

  IF public._skip_duplicate_entity_notification(
    v_player1, 'team_invite_accepted', 'league', v_league_id, 24
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, read)
  VALUES (v_player1, 'team_invite_accepted', p_title, p_body, 'league', v_league_id, false);
END;
$$;


ALTER FUNCTION "public"."notify_league_invite_accepted"("p_team_id" "uuid", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_league_invite_declined"("p_team_id" "uuid", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid;
  v_player1 uuid;
  v_league_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT lt.player1_id, lt.league_id INTO v_player1, v_league_id
  FROM public.league_teams lt
  WHERE lt.id = p_team_id AND lt.player2_id = v_caller;

  IF v_player1 IS NULL OR v_league_id IS NULL THEN
    RAISE EXCEPTION 'Ingen adgang: du er ikke player2 på dette hold';
  END IF;

  IF v_player1 = v_caller THEN
    RETURN;
  END IF;

  IF public._skip_duplicate_entity_notification(
    v_player1, 'team_invite_declined', 'league', v_league_id, 24
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, read)
  VALUES (v_player1, 'team_invite_declined', p_title, p_body, 'league', v_league_id, false);
END;
$$;


ALTER FUNCTION "public"."notify_league_invite_declined"("p_team_id" "uuid", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_makker_watchers"("p_subject_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_subject public.profiles%ROWTYPE;
  v_subject_level numeric;
  v_subject_name text;
  v_subject_region text;
  v_title text;
  v_body text;
  v_match_title text;
  v_notified integer := 0;
  v_recipient_ids uuid[] := '{}'::uuid[];
  v_match_recipient_ids uuid[] := '{}'::uuid[];
  v_matches jsonb := '[]'::jsonb;
  v_row record;
  v_daily integer;
  v_watcher_region text;
  v_watcher_days jsonb;
  v_subject_days jsonb;
  v_filt_lo numeric;
  v_filt_hi numeric;
  v_subject_lo numeric;
  v_subject_hi numeric;
  v_peer_level numeric;
  v_peer_name text;
  v_caller_body text;
  v_max_per_subject constant integer := 8;
  v_max_per_day constant integer := 5;
  v_inactive_days constant integer := 21;
  v_seek_ttl interval := interval '7 days';
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_subject FROM public.profiles p WHERE p.id = p_subject_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil findes ikke');
  END IF;

  IF COALESCE(v_subject.is_banned, false) THEN
    RETURN jsonb_build_object('ok', true, 'notified', 0, 'recipient_ids', '[]'::jsonb, 'skipped', 'banned');
  END IF;

  IF COALESCE(v_subject.seeking_match, false) = false THEN
    RETURN jsonb_build_object('ok', true, 'notified', 0, 'recipient_ids', '[]'::jsonb, 'skipped', 'not_seeking');
  END IF;

  IF v_subject.seeking_match_at IS NULL
     OR v_subject.seeking_match_at < (now() - v_seek_ttl) THEN
    RETURN jsonb_build_object('ok', true, 'notified', 0, 'recipient_ids', '[]'::jsonb, 'skipped', 'seeking_expired');
  END IF;

  IF v_caller IS DISTINCT FROM p_subject_user_id
     AND NOT COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun dig selv kan underrette makker-watchere');
  END IF;

  v_subject_level := public.match_filter_prefs_level('{}'::jsonb, v_subject.level::numeric);
  v_subject_name := COALESCE(NULLIF(trim(v_subject.full_name), ''), NULLIF(trim(v_subject.name), ''), 'En spiller');
  v_subject_region := public.canonical_app_region(
    COALESCE(NULLIF(btrim(COALESCE(v_subject.makker_search_prefs->>'region', '')), ''), v_subject.area, '')
  );
  v_subject_days := COALESCE(v_subject.makker_search_prefs->'days', '[]'::jsonb);
  IF v_subject_days IS NULL OR jsonb_typeof(v_subject_days) <> 'array' OR jsonb_array_length(v_subject_days) = 0 THEN
    v_subject_days := CASE
      WHEN v_subject.available_days IS NOT NULL AND array_length(v_subject.available_days, 1) > 0
      THEN to_jsonb(v_subject.available_days)
      ELSE '[]'::jsonb
    END;
  END IF;

  SELECT b.level_min, b.level_max INTO v_subject_lo, v_subject_hi
  FROM public.makker_filter_level_bounds(
    COALESCE(v_subject.makker_search_prefs, '{}'::jsonb),
    v_subject_level
  ) b;

  v_title := 'Ny makker passer til dit filter';
  v_match_title := 'I matcher som makkere';
  v_body := format(
    '%s søger makker · Niveau ~%s%s',
    v_subject_name,
    public.format_padel_level(v_subject_level),
    CASE WHEN v_subject_region <> '' THEN ' · ' || v_subject_region ELSE '' END
  );

  IF public.makker_feed_is_active(v_subject.makker_search_prefs, v_subject.seeking_match_at)
     AND v_subject_region <> '' THEN
    FOR v_row IN
      SELECT p.id AS user_id, p.makker_search_prefs AS prefs, p.area, p.level,
             p.full_name, p.name, p.available_days, p.last_active_at
      FROM public.profiles p
      WHERE COALESCE(p.is_banned, false) = false
        AND p.id <> p_subject_user_id
        AND public.makker_feed_is_active(p.makker_search_prefs, p.seeking_match_at)
      ORDER BY p.last_active_at DESC NULLS LAST, p.id
      LIMIT v_max_per_subject * 4
    LOOP
      EXIT WHEN jsonb_array_length(v_matches) >= v_max_per_subject;

      v_watcher_region := public.canonical_app_region(
        COALESCE(NULLIF(btrim(COALESCE(v_row.prefs->>'region', '')), ''), v_row.area, '')
      );
      IF v_watcher_region = '' OR v_watcher_region <> v_subject_region THEN
        CONTINUE;
      END IF;

      v_peer_level := public.match_filter_prefs_level(
        COALESCE(v_row.prefs, '{}'::jsonb),
        v_row.level::numeric
      );

      SELECT b.level_min, b.level_max INTO v_filt_lo, v_filt_hi
      FROM public.makker_filter_level_bounds(
        COALESCE(v_row.prefs, '{}'::jsonb),
        v_peer_level
      ) b;
      IF v_subject_level < v_filt_lo OR v_subject_level > v_filt_hi THEN
        CONTINUE;
      END IF;
      IF v_peer_level < v_subject_lo OR v_peer_level > v_subject_hi THEN
        CONTINUE;
      END IF;

      v_watcher_days := COALESCE(v_row.prefs->'days', '[]'::jsonb);
      IF v_watcher_days IS NULL OR jsonb_typeof(v_watcher_days) <> 'array' OR jsonb_array_length(v_watcher_days) = 0 THEN
        v_watcher_days := CASE
          WHEN v_row.available_days IS NOT NULL AND array_length(v_row.available_days, 1) > 0
          THEN to_jsonb(v_row.available_days)
          ELSE '[]'::jsonb
        END;
      END IF;
      IF jsonb_array_length(v_watcher_days) > 0 AND jsonb_array_length(v_subject_days) > 0 THEN
        IF NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(v_watcher_days) AS w(day_key)
          WHERE w.day_key IN (
            SELECT jsonb_array_elements_text(v_subject_days)
          )
        ) THEN
          CONTINUE;
        END IF;
      END IF;

      v_peer_name := COALESCE(NULLIF(trim(v_row.full_name), ''), NULLIF(trim(v_row.name), ''), 'En spiller');

      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_row.user_id
          AND n.type = 'makker_suggestion'
          AND n.entity_type = 'profile'
          AND n.entity_id = p_subject_user_id
          AND n.created_at >= now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
        VALUES (
          v_row.user_id, 'makker_suggestion', v_match_title, v_body, NULL,
          'profile', p_subject_user_id, false
        );
        v_notified := v_notified + 1;
        v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
        v_match_recipient_ids := array_append(v_match_recipient_ids, v_row.user_id);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p_subject_user_id
          AND n.type = 'makker_suggestion'
          AND n.entity_type = 'profile'
          AND n.entity_id = v_row.user_id
          AND n.created_at >= now() - interval '7 days'
      ) THEN
        v_caller_body := format(
          '%s søger også makker · Niveau ~%s%s',
          v_peer_name,
          public.format_padel_level(v_peer_level),
          CASE WHEN v_watcher_region <> '' THEN ' · ' || v_watcher_region ELSE '' END
        );
        INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
        VALUES (
          p_subject_user_id, 'makker_suggestion', v_match_title, v_caller_body, NULL,
          'profile', v_row.user_id, false
        );
      END IF;

      v_matches := v_matches || jsonb_build_array(jsonb_build_object(
        'id', v_row.user_id,
        'name', v_peer_name,
        'region', v_watcher_region
      ));
    END LOOP;
  END IF;

  FOR v_row IN
    SELECT p.id AS user_id, p.makker_search_prefs AS prefs, p.area, p.level, p.court_side,
           p.match_watch_enabled, p.last_active_at
    FROM public.profiles p
    WHERE COALESCE(p.is_banned, false) = false
      AND p.id <> p_subject_user_id
      AND p.id <> ALL (v_recipient_ids)
      AND (
        COALESCE((p.makker_search_prefs->>'notify')::boolean, false) = true
        OR (p.makker_watch_enabled = true AND (p.makker_search_prefs IS NULL OR p.makker_search_prefs = '{}'::jsonb))
      )
      AND (
        p.last_active_at IS NULL
        OR p.last_active_at >= (now() - (v_inactive_days || ' days')::interval)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'makker_suggestion'
          AND n.entity_type = 'profile'
          AND n.entity_id = p_subject_user_id
          AND n.created_at >= now() - interval '7 days'
      )
    ORDER BY p.last_active_at DESC NULLS LAST, p.id
    LIMIT v_max_per_subject * 4
  LOOP
    EXIT WHEN v_notified >= v_max_per_subject;

    v_watcher_region := public.canonical_app_region(
      COALESCE(NULLIF(btrim(COALESCE(v_row.prefs->>'region', '')), ''), v_row.area, '')
    );
    IF v_subject_region <> '' THEN
      IF v_watcher_region = '' OR v_watcher_region <> v_subject_region THEN
        CONTINUE;
      END IF;
    END IF;

    SELECT b.level_min, b.level_max INTO v_filt_lo, v_filt_hi
    FROM public.makker_filter_level_bounds(
      COALESCE(v_row.prefs, '{}'::jsonb),
      public.match_filter_prefs_level(COALESCE(v_row.prefs, '{}'::jsonb), v_row.level::numeric)
    ) b;

    IF v_subject_level < v_filt_lo OR v_subject_level > v_filt_hi THEN
      CONTINUE;
    END IF;

    IF NOT public.makker_filter_partner_court_side_ok(
      COALESCE(v_row.prefs, '{}'::jsonb),
      v_row.court_side,
      v_subject.court_side
    ) THEN
      CONTINUE;
    END IF;

    IF NOT public.makker_filter_play_style_ok(
      COALESCE(v_row.prefs->>'playStyle', 'all'),
      v_subject.play_style
    ) THEN
      CONTINUE;
    END IF;

    IF NOT public.makker_filter_intent_ok(
      COALESCE(v_row.prefs->'intents', '[]'::jsonb),
      COALESCE(v_row.prefs->>'intentMode', 'compatible'),
      v_subject.intent_now
    ) THEN
      CONTINUE;
    END IF;

    IF NOT public.makker_filter_availability_overlap(
      COALESCE(v_row.prefs->'availability', '[]'::jsonb),
      v_subject.availability
    ) THEN
      CONTINUE;
    END IF;

    v_watcher_days := COALESCE(v_row.prefs->'days', '[]'::jsonb);
    IF jsonb_array_length(v_watcher_days) > 0 THEN
      IF jsonb_array_length(v_subject_days) = 0 THEN
        NULL;
      ELSIF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_watcher_days) AS w(day_key)
        WHERE w.day_key IN (
          SELECT jsonb_array_elements_text(v_subject_days)
        )
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    v_daily := public.discovery_notifications_today_count(
      v_row.user_id,
      ARRAY['makker_suggestion']::text[]
    );
    IF v_daily >= v_max_per_day THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (v_row.user_id, 'makker_suggestion', v_title, v_body, NULL, 'profile', p_subject_user_id, false);

    v_notified := v_notified + 1;
    v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'notified', v_notified,
    'recipient_ids', to_jsonb(v_recipient_ids),
    'match_recipient_ids', to_jsonb(v_match_recipient_ids),
    'matches', v_matches,
    'notify_title', v_title,
    'notify_body', v_body,
    'match_title', v_match_title,
    'subject_level', v_subject_level
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."notify_makker_watchers"("p_subject_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_match_creator_on_join"("p_match_id" "uuid", "p_title" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_creator uuid;
  v_joiner uuid;
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('match_creator_join_notify', 20, 3600);
  END IF;

  SELECT m.creator_id INTO v_creator FROM public.matches m WHERE m.id = p_match_id;
  IF v_creator IS NULL OR v_creator = v_joiner THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_joiner
  ) THEN
    RAISE EXCEPTION 'Du er ikke tilmeldt denne kamp';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = v_creator
      AND n.match_id = p_match_id
      AND n.type = 'match_join'
      AND n.created_at > now() - interval '3 minutes'
      AND n.body = left(coalesce(p_body, ''), 500)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_join', p_title, p_body, p_match_id, false);
END;
$$;


ALTER FUNCTION "public"."notify_match_creator_on_join"("p_match_id" "uuid", "p_title" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_match_watchers"("p_match_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_match public.matches%ROWTYPE;
  v_creator public.profiles%ROWTYPE;
  v_creator_region text;
  v_match_elo integer;
  v_title text;
  v_body text;
  v_notified integer := 0;
  v_recipient_ids uuid[] := '{}'::uuid[];
  v_row record;
  v_daily integer;
  v_elo_min integer;
  v_elo_max integer;
  v_max_per_match constant integer := 8;
  v_max_per_day constant integer := 5;
  v_elo_window constant integer := 250;
  v_inactive_days constant integer := 21;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_match FROM public.matches m WHERE m.id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kamp findes ikke');
  END IF;

  IF COALESCE(v_match.status, '') <> 'open'
     OR COALESCE(v_match.match_type, 'open') = 'closed'
     OR COALESCE(v_match.current_players, 0) >= COALESCE(v_match.max_players, 4) THEN
    RETURN jsonb_build_object('ok', true, 'notified', 0, 'recipient_ids', '[]'::jsonb, 'skipped', 'not_open');
  END IF;

  IF v_caller IS DISTINCT FROM v_match.creator_id
     AND NOT COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun kampens opretter kan underrette watchere');
  END IF;

  SELECT * INTO v_creator FROM public.profiles p WHERE p.id = v_match.creator_id;
  v_creator_region := public.canonical_app_region(v_creator.area);
  v_match_elo := GREATEST(100, ROUND(COALESCE(v_creator.elo_rating, 1000))::integer);
  v_elo_min := v_match_elo - v_elo_window;
  v_elo_max := v_match_elo + v_elo_window;

  v_title := 'Ny kamp passer til dig';
  v_body := format(
    'Åben kamp på %s%s%s · ELO ~%s',
    COALESCE(NULLIF(trim(v_match.court_name), ''), 'en bane'),
    CASE WHEN v_match.date IS NOT NULL THEN ' · ' || to_char(v_match.date::date, 'DD/MM') ELSE '' END,
    CASE WHEN v_match.time IS NOT NULL THEN ' kl. ' || left(v_match.time::text, 5) ELSE '' END,
    v_match_elo
  );

  FOR v_row IN
    SELECT DISTINCT ON (i.user_id) i.user_id
    FROM public.play_intents i
    JOIN public.profiles p ON p.id = i.user_id
    WHERE i.status = 'open'
      AND i.play_date = v_match.date
      AND i.user_id IS DISTINCT FROM v_match.creator_id
      AND COALESCE(p.is_banned, false) = false
      AND i.user_id <> ALL (
        SELECT mp.user_id FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id IS NOT NULL
      )
      AND public.play_intent_overlaps_match_time(
        i.start_time, i.end_time, v_match.time, v_match.time_end
      )
      AND (
        i.play_date > (timezone('Europe/Copenhagen', now()))::date
        OR (
          i.play_date = (timezone('Europe/Copenhagen', now()))::date
          AND i.end_time > (timezone('Europe/Copenhagen', now()))::time
        )
      )
      AND (
        v_creator_region = ''
        OR i.region = v_creator_region
        OR public.canonical_app_region(p.area) = v_creator_region
      )
      AND GREATEST(100, ROUND(COALESCE(p.elo_rating, 1000))::integer) BETWEEN v_elo_min AND v_elo_max
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = i.user_id
          AND n.type = 'match_watch_match'
          AND n.match_id = p_match_id
          AND n.created_at >= now() - interval '7 days'
      )
    ORDER BY i.user_id
    LIMIT v_max_per_match
  LOOP
    EXIT WHEN v_notified >= v_max_per_match;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (v_row.user_id, 'match_watch_match', v_title, v_body, p_match_id, false);

    v_notified := v_notified + 1;
    v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
  END LOOP;

  FOR v_row IN
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.match_watch_enabled = true
      AND COALESCE(p.is_banned, false) = false
      AND p.id <> v_match.creator_id
      AND p.id <> ALL (
        SELECT mp.user_id FROM public.match_players mp WHERE mp.match_id = p_match_id
      )
      AND p.id <> ALL (v_recipient_ids)
      AND (
        v_creator_region = ''
        OR public.canonical_app_region(p.area) = v_creator_region
      )
      AND GREATEST(100, ROUND(COALESCE(p.elo_rating, 1000))::integer) BETWEEN v_elo_min AND v_elo_max
      AND (
        p.last_active_at IS NULL
        OR p.last_active_at >= (now() - (v_inactive_days || ' days')::interval)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'match_watch_match'
          AND n.match_id = p_match_id
          AND n.created_at >= now() - interval '7 days'
      )
    ORDER BY
      (CASE WHEN p.seeking_match = true THEN 1 ELSE 0 END) DESC,
      p.last_active_at DESC NULLS LAST,
      p.id
    LIMIT v_max_per_match * 3
  LOOP
    EXIT WHEN v_notified >= v_max_per_match;

    v_daily := public.discovery_notifications_today_count(
      v_row.user_id,
      ARRAY['match_watch_match']::text[]
    );
    IF v_daily >= v_max_per_day THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (v_row.user_id, 'match_watch_match', v_title, v_body, p_match_id, false);

    v_notified := v_notified + 1;
    v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'notified', v_notified,
    'recipient_ids', to_jsonb(v_recipient_ids),
    'notify_title', v_title,
    'notify_body', v_body,
    'match_elo', v_match_elo
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."notify_match_watchers"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."padel_elo_to_level"("p_elo" integer) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT ROUND(
    GREATEST(1.0, LEAST(7.0,
      1.0 + (GREATEST(400, LEAST(3000, COALESCE(p_elo, 1000))) - 800)::numeric / (400.0 / 6.0)
    ))::numeric,
    1
  );
$$;


ALTER FUNCTION "public"."padel_elo_to_level"("p_elo" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."padel_level_to_elo"("p_level" numeric) RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT GREATEST(400, LEAST(3000, ROUND(
    (800 + (GREATEST(1.0, LEAST(7.0, COALESCE(p_level, 3.0))) - 1.0) * (400.0 / 6.0))
  )::numeric)::integer);
$$;


ALTER FUNCTION "public"."padel_level_to_elo"("p_level" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_clock_time"("p_value" "text") RETURNS time without time zone
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := btrim(COALESCE(p_value, ''));
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;
  IF v_raw ~ '^\d{1,2}:\d{2}(:\d{2})?' THEN
    RETURN v_raw::time;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."parse_clock_time"("p_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."play_intent_overlaps_match_time"("p_intent_start" time without time zone, "p_intent_end" time without time zone, "p_match_time" "text", "p_match_time_end" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_start time;
  v_end time;
BEGIN
  IF p_intent_start IS NULL OR p_intent_end IS NULL OR p_intent_end <= p_intent_start THEN
    RETURN false;
  END IF;

  v_start := public.parse_clock_time(p_match_time);
  IF v_start IS NULL THEN
    RETURN true;
  END IF;

  v_end := public.parse_clock_time(p_match_time_end);
  IF v_end IS NULL OR v_end <= v_start THEN
    v_end := (v_start + interval '90 minutes')::time;
    IF v_end <= v_start THEN
      v_end := time '23:59:59';
    END IF;
  END IF;

  RETURN p_intent_start < v_end AND p_intent_end > v_start;
END;
$$;


ALTER FUNCTION "public"."play_intent_overlaps_match_time"("p_intent_start" time without time zone, "p_intent_end" time without time zone, "p_match_time" "text", "p_match_time_end" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_elo_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.phone_verification_exempt, false) IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
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


ALTER FUNCTION "public"."protect_elo_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_americano_preview"("p_tournament_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_t public.americano_tournaments%ROWTYPE;
  v_court text;
  v_participants bigint;
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
BEGIN
  SELECT * INTO v_t FROM public.americano_tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  IF v_t.status NOT IN ('registration', 'playing') THEN
    RETURN json_build_object('found', false, 'reason', 'not_available');
  END IF;

  IF v_t.tournament_date IS NOT NULL AND v_t.tournament_date < v_today AND v_t.status <> 'playing' THEN
    RETURN json_build_object('found', false, 'reason', 'past');
  END IF;

  SELECT c.name INTO v_court FROM public.courts c WHERE c.id = v_t.court_id;
  SELECT count(*)::bigint INTO v_participants
  FROM public.americano_participants ap
  WHERE ap.tournament_id = v_t.id;

  RETURN json_build_object(
    'found', true,
    'id', v_t.id,
    'name', v_t.name,
    'format', coalesce(v_t.format, 'americano'),
    'tournament_date', v_t.tournament_date,
    'time_slot', v_t.time_slot,
    'status', v_t.status,
    'player_slots', coalesce(v_t.player_slots, 0),
    'points_per_match', coalesce(v_t.points_per_match, 0),
    'participant_count', coalesce(v_participants, 0),
    'court_name', coalesce(nullif(trim(v_court), ''), 'Bane ikke angivet'),
    'description', left(coalesce(trim(v_t.description), ''), 280)
  );
END;
$$;


ALTER FUNCTION "public"."public_americano_preview"("p_tournament_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_match_preview"("p_match_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_creator_name text;
  v_level text;
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  IF v_match.status IN ('cancelled', 'completed') THEN
    RETURN json_build_object('found', false, 'reason', 'not_available');
  END IF;

  IF v_match.status <> 'in_progress' AND v_match.date IS NOT NULL AND v_match.date < v_today THEN
    RETURN json_build_object('found', false, 'reason', 'past');
  END IF;

  SELECT coalesce(
    nullif(split_part(trim(p.full_name), ' ', 1), ''),
    nullif(trim(p.name), ''),
    'En spiller'
  )
  INTO v_creator_name
  FROM public.profiles p
  WHERE p.id = v_match.creator_id;

  v_level := coalesce(nullif(trim(v_match.level_range), ''), '');

  RETURN json_build_object(
    'found', true,
    'id', v_match.id,
    'court_name', coalesce(nullif(trim(v_match.court_name), ''), 'Padel'),
    'date', v_match.date,
    'time', v_match.time,
    'time_end', v_match.time_end,
    'status', v_match.status,
    'match_type', coalesce(v_match.match_type, 'open'),
    'level_range', v_level,
    'current_players', coalesce(v_match.current_players, 0),
    'max_players', coalesce(v_match.max_players, 4),
    'description', left(coalesce(trim(v_match.description), ''), 280),
    'creator_first_name', v_creator_name
  );
END;
$$;


ALTER FUNCTION "public"."public_match_preview"("p_match_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_platform_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."public_platform_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer DEFAULT 24) RETURNS TABLE("id" "uuid", "name" "text", "tournament_date" "date", "time_slot" "text", "player_slots" integer, "points_per_match" integer, "status" "text", "description" "text", "participant_count" bigint, "court_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT t.id, t.name, t.tournament_date, t.time_slot, t.player_slots, t.points_per_match,
    t.status, t.description, count(p.id)::bigint AS participant_count, c.name AS court_name
  FROM public.americano_tournaments t
  LEFT JOIN public.courts c ON c.id=t.court_id
  LEFT JOIN public.americano_participants p ON p.tournament_id=t.id
  WHERE t.tournament_date>=(timezone('Europe/Copenhagen',now()))::date AND t.status IN ('registration','playing')
  GROUP BY t.id, c.id
  ORDER BY t.tournament_date ASC, t.time_slot ASC, t.created_at ASC
  LIMIT greatest(1,least(coalesce(p_limit,24),100));
$$;


ALTER FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer) IS 'Offentlig: kommende Americano (registration/playing) til marketing /events — uden persondata.';



CREATE OR REPLACE FUNCTION "public"."recalc_americano_elo_from_history"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."recalc_americano_elo_from_history"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_americano_profile_stats"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  w int;
  l int;
  d int;
  p int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Sejre (runder)
  SELECT COUNT(*)::int INTO w
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score <> m.team_b_score
    AND (
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_a_p1, m.team_a_p2)) AND m.team_a_score > m.team_b_score)
      OR
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_b_p1, m.team_b_p2)) AND m.team_b_score > m.team_a_score)
    );

  -- Tab (runder)
  SELECT COUNT(*)::int INTO l
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score <> m.team_b_score
    AND (
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_a_p1, m.team_a_p2)) AND m.team_b_score > m.team_a_score)
      OR
      (EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_b_p1, m.team_b_p2)) AND m.team_a_score > m.team_b_score)
    );

  -- Uafgjort (runder)
  SELECT COUNT(*)::int INTO d
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score = m.team_b_score
    AND (
      EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_a_p1, m.team_a_p2))
      OR
      EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = p_user_id AND ap.id IN (m.team_b_p1, m.team_b_p2))
    );

  -- ANTAL TURNERINGER SPILLET (afsluttede)
  SELECT COUNT(DISTINCT tournament_id)::int INTO p
  FROM public.americano_participants ap
  JOIN public.americano_tournaments t ON t.id = ap.tournament_id
  WHERE ap.user_id = p_user_id AND t.status = 'completed';

  UPDATE public.profiles
  SET
    americano_wins = COALESCE(w, 0),
    americano_losses = COALESCE(l, 0),
    americano_draws = COALESCE(d, 0),
    americano_played = COALESCE(p, 0)
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."recalc_americano_profile_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalc_profile_stats_from_elo_history"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_first numeric;
  v_delta numeric;
  v_games int;
  v_wins  int;
BEGIN
  -- Tæl rigtige kampe
  SELECT COUNT(*)::int INTO v_games FROM public.elo_history
  WHERE user_id = p_user_id AND match_id IS NOT NULL;

  -- FIX: Tæl faktiske sejre fra elo_history (var aldrig tildelt før!)
  SELECT COUNT(*)::int INTO v_wins FROM public.elo_history
  WHERE user_id = p_user_id AND match_id IS NOT NULL AND result = 'win';

  -- Find fundamentet (første rating)
  SELECT e.old_rating::numeric INTO v_first FROM public.elo_history e
  WHERE e.user_id = p_user_id AND e.old_rating IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST LIMIT 1;

  -- Beregn samlet ændring
  SELECT COALESCE(SUM(CASE
    WHEN change IS NOT NULL THEN change::numeric
    WHEN new_rating IS NOT NULL AND old_rating IS NOT NULL THEN (new_rating - old_rating)::numeric
    ELSE 0 END), 0) INTO v_delta
  FROM public.elo_history WHERE user_id = p_user_id;

  -- Bypass protect_elo_fields triggeren (transaction-scoped, nulstilles automatisk)
  PERFORM set_config('app.bypass_elo_protection', 'true', true);

  -- Opdater profilen
  UPDATE public.profiles SET
    elo_rating   = GREATEST(100, ROUND(COALESCE(v_first, 1000) + COALESCE(v_delta, 0))::int),
    games_played = COALESCE(v_games, 0),
    games_won    = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."recalc_profile_stats_from_elo_history"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_americano_match_score"("p_match_id" "uuid", "p_score_a" integer, "p_score_b" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid(); v_match public.americano_matches%ROWTYPE; v_ppm int; v_status text; v_is_player boolean; v_earlier_open boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  SELECT * INTO v_match FROM public.americano_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'match_not_found'); END IF;
  IF COALESCE(v_match.results_locked, false) = true THEN RETURN jsonb_build_object('success', false, 'error', 'already_locked'); END IF;
  SELECT status, points_per_match INTO v_status, v_ppm FROM public.americano_tournaments WHERE id = v_match.tournament_id;
  IF v_status <> 'playing' THEN RETURN jsonb_build_object('success', false, 'error', 'tournament_not_playing'); END IF;
  SELECT EXISTS (SELECT 1 FROM public.americano_participants ap WHERE ap.user_id = v_uid AND ap.id IN (v_match.team_a_p1, v_match.team_a_p2, v_match.team_b_p1, v_match.team_b_p2)) INTO v_is_player;
  IF NOT v_is_player THEN RETURN jsonb_build_object('success', false, 'error', 'not_on_court'); END IF;
  SELECT EXISTS (SELECT 1 FROM public.americano_matches am WHERE am.tournament_id = v_match.tournament_id AND am.round_number < v_match.round_number AND COALESCE(am.results_locked, false) = false) INTO v_earlier_open;
  IF v_earlier_open THEN RETURN jsonb_build_object('success', false, 'error', 'earlier_round_open'); END IF;
  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a < 0 OR p_score_b < 0 OR (p_score_a + p_score_b) <> v_ppm THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_score');
  END IF;
  UPDATE public.americano_matches SET team_a_score = p_score_a, team_b_score = p_score_b, results_locked = true, updated_at = now() WHERE id = p_match_id;
  RETURN jsonb_build_object('success', true);
END; $$;


ALTER FUNCTION "public"."report_americano_match_score"("p_match_id" "uuid", "p_score_a" integer, "p_score_b" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_user"("p_reported_id" "uuid", "p_reason" "text", "p_details" "text" DEFAULT NULL::"text", "p_context" "text" DEFAULT 'dm'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_details text;
  v_reporter_name text;
  v_reported_name text;
  v_reason_label text;
  v_title text := 'Ny spilleranmeldelse';
  v_body text;
  v_admin_ids uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text, integer, integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('user_report', 10, 86400);
  END IF;

  IF p_reported_id IS NULL OR p_reported_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig bruger');
  END IF;
  IF p_reason NOT IN ('harassment', 'spam', 'inappropriate', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en gyldig årsag');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke anmelde spillere');
  END IF;

  v_details := nullif(trim(coalesce(p_details, '')), '');
  IF length(v_details) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beskrivelsen er for lang (max 2000 tegn)');
  END IF;

  INSERT INTO public.user_reports (reporter_id, reported_id, reason, details, context)
  VALUES (
    v_caller,
    p_reported_id,
    p_reason,
    v_details,
    coalesce(nullif(trim(p_context), ''), 'dm')
  );

  SELECT coalesce(nullif(trim(full_name), ''), nullif(trim(name), ''), 'En spiller')
  INTO v_reporter_name FROM public.profiles WHERE id = v_caller;

  SELECT coalesce(nullif(trim(full_name), ''), nullif(trim(name), ''), 'En spiller')
  INTO v_reported_name FROM public.profiles WHERE id = p_reported_id;

  v_reason_label := CASE p_reason
    WHEN 'harassment' THEN 'Chikane eller trusler'
    WHEN 'spam' THEN 'Spam eller reklame'
    WHEN 'inappropriate' THEN 'Upassende indhold'
    ELSE 'Andet'
  END;

  v_body := format(
    '%s har anmeldt %s (%s). Gå til Admin → Anmeldelser for at gennemgå.',
    v_reporter_name,
    v_reported_name,
    v_reason_label
  );

  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT p.id, 'user_report', v_title, v_body, NULL, false
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin';
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
  END IF;

  SELECT coalesce(array_agg(p.id ORDER BY p.id), '{}'::uuid[])
  INTO v_admin_ids
  FROM public.profiles p
  WHERE lower(COALESCE(p.role, '')) = 'admin';

  RETURN jsonb_build_object(
    'ok', true,
    'admin_ids', v_admin_ids,
    'notify_title', v_title,
    'notify_body', v_body
  );
END;
$$;


ALTER FUNCTION "public"."report_user"("p_reported_id" "uuid", "p_reason" "text", "p_details" "text", "p_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_to_match_proposal"("p_proposal_id" "uuid", "p_accept" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_proposal public.match_proposals%ROWTYPE;
  v_pending integer;
  v_match_id uuid;
  v_row record;
  v_team integer := 1;
  v_seat integer := 0;
  v_title text;
  v_body text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_proposal
  FROM public.match_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forslaget findes ikke');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_proposal_members
    WHERE proposal_id = p_proposal_id AND user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Du er ikke med i dette forslag');
  END IF;

  IF v_proposal.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_proposal.status, 'match_id', v_proposal.match_id);
  END IF;

  IF v_proposal.expires_at <= now() THEN
    UPDATE public.match_proposals SET status = 'expired' WHERE id = p_proposal_id;
    UPDATE public.play_intents SET status = 'expired'
    WHERE proposal_id = p_proposal_id AND status = 'proposed';
    RETURN jsonb_build_object('ok', true, 'status', 'expired');
  END IF;

  UPDATE public.match_proposal_members
  SET response = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE proposal_id = p_proposal_id AND user_id = v_caller;

  IF NOT p_accept THEN
    UPDATE public.match_proposals SET status = 'declined' WHERE id = p_proposal_id;

    UPDATE public.play_intents SET status = 'cancelled', proposal_id = NULL
    WHERE proposal_id = p_proposal_id AND user_id = v_caller;

    UPDATE public.play_intents SET status = 'open', proposal_id = NULL
    WHERE proposal_id = p_proposal_id AND status = 'proposed';

    INSERT INTO public.notifications
      (user_id, type, title, body, match_id, entity_type, entity_id, read)
    SELECT m.user_id,
           'match_proposal_declined',
           'Kampen blev ikke til noget',
           'En spiller kunne ikke alligevel. Du står stadig klar i puljen.',
           NULL, 'match_proposal', p_proposal_id, false
    FROM public.match_proposal_members m
    WHERE m.proposal_id = p_proposal_id AND m.user_id <> v_caller;

    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  SELECT COUNT(*) INTO v_pending
  FROM public.match_proposal_members
  WHERE proposal_id = p_proposal_id AND response <> 'accepted';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'pending', 'awaiting', v_pending);
  END IF;

  INSERT INTO public.matches (creator_id, date, "time", time_end, status, max_players, current_players, description)
  VALUES (
    (SELECT user_id FROM public.match_proposal_members
      WHERE proposal_id = p_proposal_id ORDER BY responded_at NULLS LAST LIMIT 1),
    v_proposal.play_date,
    to_char(v_proposal.start_time, 'HH24:MI'),
    to_char(v_proposal.end_time, 'HH24:MI'),
    'full',
    4,
    4,
    'Samlet automatisk af PadelMakker — husk at booke bane'
  )
  RETURNING id INTO v_match_id;

  FOR v_row IN
    SELECT m.user_id,
           COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.name), ''), 'Spiller') AS navn,
           COALESCE(NULLIF(btrim(p.avatar_emoji), ''), '🎾') AS emoji
    FROM public.match_proposal_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.proposal_id = p_proposal_id
    ORDER BY m.responded_at NULLS LAST, m.user_id
  LOOP
    v_team := CASE WHEN v_seat < 2 THEN 1 ELSE 2 END;
    INSERT INTO public.match_players (match_id, user_id, user_name, user_emoji, team)
    VALUES (v_match_id, v_row.user_id, v_row.navn, v_row.emoji, v_team);
    v_seat := v_seat + 1;
  END LOOP;

  UPDATE public.match_proposals
  SET status = 'confirmed', match_id = v_match_id
  WHERE id = p_proposal_id;

  UPDATE public.play_intents SET status = 'matched'
  WHERE proposal_id = p_proposal_id;

  v_title := 'Kampen er booket ind';
  v_body := format(
    'Alle fire har bekræftet %s kl. %s. Aftal bane i chatten.',
    to_char(v_proposal.play_date, 'DD/MM'),
    to_char(v_proposal.start_time, 'HH24:MI')
  );

  INSERT INTO public.notifications
    (user_id, type, title, body, match_id, entity_type, entity_id, read)
  SELECT m.user_id, 'match_proposal_confirmed', v_title, v_body, v_match_id, 'match', v_match_id, false
  FROM public.match_proposal_members m
  WHERE m.proposal_id = p_proposal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'match_id', v_match_id);
END;
$$;


ALTER FUNCTION "public"."respond_to_match_proposal"("p_proposal_id" "uuid", "p_accept" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "sender_email" "text",
    "receiver_email" "text",
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "payload" "jsonb",
    "reaction" "text",
    CONSTRAINT "messages_message_type_chk" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'match_invite'::"text", 'venue_share'::"text", 'time_suggestion'::"text"]))),
    CONSTRAINT "messages_reaction_len_chk" CHECK ((("reaction" IS NULL) OR (("char_length"("reaction") >= 1) AND ("char_length"("reaction") <= 8))))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_dm_message_reaction"("p_message_id" "uuid", "p_reaction" "text") RETURNS "public"."messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE v_row public.messages; v_uid uuid := auth.uid(); v_reaction text := nullif(btrim(p_reaction), ''); BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF; IF v_reaction IS NOT NULL AND char_length(v_reaction) > 8 THEN RAISE EXCEPTION 'Ugyldig reaktion'; END IF; UPDATE public.messages m SET reaction = v_reaction WHERE m.id = p_message_id AND (m.sender_id = v_uid OR m.receiver_id = v_uid) RETURNING * INTO v_row; IF v_row.id IS NULL THEN RAISE EXCEPTION 'Besked ikke fundet'; END IF; RETURN v_row; END; $$;


ALTER FUNCTION "public"."set_dm_message_reaction"("p_message_id" "uuid", "p_reaction" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_team_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "league_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_name" "text" DEFAULT ''::"text" NOT NULL,
    "sender_avatar" "text",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "payload" "jsonb",
    "reaction" "text",
    CONSTRAINT "league_team_messages_content_len_chk" CHECK ((("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 1000))),
    CONSTRAINT "league_team_messages_message_type_chk" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'match_invite'::"text", 'venue_share'::"text", 'time_suggestion'::"text"]))),
    CONSTRAINT "league_team_messages_reaction_len_chk" CHECK ((("reaction" IS NULL) OR (("char_length"("reaction") >= 1) AND ("char_length"("reaction") <= 8))))
);


ALTER TABLE "public"."league_team_messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_league_team_message_reaction"("p_message_id" "uuid", "p_reaction" "text") RETURNS "public"."league_team_messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE v_row public.league_team_messages; v_uid uuid := auth.uid(); v_reaction text := nullif(btrim(p_reaction), ''); BEGIN IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF; IF v_reaction IS NOT NULL AND char_length(v_reaction) > 8 THEN RAISE EXCEPTION 'Ugyldig reaktion'; END IF; UPDATE public.league_team_messages m SET reaction = v_reaction WHERE m.id = p_message_id AND public.is_league_participant(m.league_id) RETURNING * INTO v_row; IF v_row.id IS NULL THEN RAISE EXCEPTION 'Besked ikke fundet'; END IF; RETURN v_row; END; $$;


ALTER FUNCTION "public"."set_league_team_message_reaction"("p_message_id" "uuid", "p_reaction" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_match_player_court_side"("p_match_id" "uuid", "p_user_id" "uuid", "p_side" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid;
  v_creator_id uuid;
  v_status text;
  v_team int;
  v_current text;
  v_side text;
  v_other uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_side := CASE
    WHEN p_side IN ('left', 'right') THEN p_side
    WHEN lower(coalesce(p_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p_side, '')) LIKE '%højre%'
      OR lower(coalesce(p_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END;

  IF v_side IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_side');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status NOT IN ('open', 'full', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  IF p_user_id <> v_caller
     AND v_creator_id <> v_caller
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT mp.team, mp.court_side
  INTO v_team, v_current
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_in_match');
  END IF;

  IF v_current = v_side THEN
    RETURN jsonb_build_object('success', true, 'court_side', v_side, 'unchanged', true);
  END IF;

  SELECT mp.user_id
  INTO v_other
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.team = v_team
    AND mp.user_id <> p_user_id
    AND mp.court_side = v_side
  LIMIT 1;

  UPDATE public.match_players
  SET court_side = NULL
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  IF v_other IS NOT NULL THEN
    UPDATE public.match_players
    SET court_side = coalesce(v_current, CASE WHEN v_side = 'left' THEN 'right' ELSE 'left' END)
    WHERE match_id = p_match_id
      AND user_id = v_other;
  END IF;

  UPDATE public.match_players
  SET court_side = v_side
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'court_side', v_side,
    'swapped_user_id', v_other
  );
END;
$$;


ALTER FUNCTION "public"."set_match_player_court_side"("p_match_id" "uuid", "p_user_id" "uuid", "p_side" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_match_player_team"("p_match_id" "uuid", "p_user_id" "uuid", "p_team" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_caller uuid;
  v_creator_id uuid;
  v_status text;
  v_current_team int;
  v_t1 int;
  v_t2 int;
  v_target_count int;
  v_total int;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_team NOT IN (1, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_team');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  IF p_user_id <> v_caller
     AND v_creator_id <> v_caller
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT mp.team
  INTO v_current_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_in_match');
  END IF;

  IF v_current_team = p_team THEN
    RETURN jsonb_build_object('success', true, 'team', p_team, 'unchanged', true);
  END IF;

  SELECT COUNT(*)
  INTO v_target_count
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.team = p_team;

  IF v_target_count >= 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', p_team);
  END IF;

  UPDATE public.match_players
  SET team = p_team,
      court_side = NULL
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 1),
    COUNT(*) FILTER (WHERE team = 2),
    COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_t1 > 2 OR v_t2 > 2 THEN
    UPDATE public.match_players
    SET team = v_current_team,
        court_side = NULL
    WHERE match_id = p_match_id
      AND user_id = p_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', p_team);
  END IF;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE public.matches
    SET status = 'full',
        current_players = v_total,
        seeking_player = false
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches
    SET status = 'open',
        current_players = v_total
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', p_team);
END;
$$;


ALTER FUNCTION "public"."set_match_player_team"("p_match_id" "uuid", "p_user_id" "uuid", "p_team" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_result_error_report"("p_source_type" "text", "p_entity_id" "uuid", "p_reason" "text", "p_details" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_details text;
  v_completed_at timestamptz;
  v_entity_label text;
  v_reporter_name text;
  v_reason_label text;
  v_is_creator boolean := false;
  v_status text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke indberette fejl');
  END IF;
  IF p_source_type NOT IN ('match_2v2', 'americano', 'league') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig kildetype');
  END IF;
  IF p_entity_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende reference');
  END IF;
  IF p_reason NOT IN ('elo', 'points', 'result', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en gyldig fejltype');
  END IF;

  v_details := nullif(trim(coalesce(p_details, '')), '');
  IF length(v_details) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beskrivelsen er for lang (max 2000 tegn)');
  END IF;

  IF p_source_type = 'match_2v2' THEN
    SELECT
      (m.creator_id = v_caller),
      m.status,
      coalesce(nullif(trim(m.court_name), ''), '2v2-kamp')
    INTO v_is_creator, v_status, v_entity_label
    FROM public.matches m
    WHERE m.id = p_entity_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kampen findes ikke');
    END IF;
    IF v_status IS DISTINCT FROM 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede kampe kan indberettes');
    END IF;
  ELSIF p_source_type = 'americano' THEN
    SELECT
      (t.creator_id = v_caller),
      t.status,
      coalesce(nullif(trim(t.name), ''), 'Americano')
    INTO v_is_creator, v_status, v_entity_label
    FROM public.americano_tournaments t
    WHERE t.id = p_entity_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Turneringen findes ikke');
    END IF;
    IF v_status IS DISTINCT FROM 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede turneringer kan indberettes');
    END IF;
  ELSE
    SELECT
      (l.created_by = v_caller),
      l.status,
      coalesce(nullif(trim(l.name), ''), 'Liga')
    INTO v_is_creator, v_status, v_entity_label
    FROM public.leagues l
    WHERE l.id = p_entity_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ligaen findes ikke');
    END IF;
    IF v_status IS DISTINCT FROM 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede ligaer kan indberettes');
    END IF;
  END IF;

  IF NOT v_is_creator THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun opretteren kan indberette fejl');
  END IF;

  v_completed_at := public._result_error_entity_completed_at(p_source_type, p_entity_id);
  IF v_completed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kunne ikke fastslå afslutningstidspunkt');
  END IF;
  IF now() > v_completed_at + interval '24 hours' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Fristen på 24 timer efter afslutning er udløbet'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.result_error_reports r
    WHERE r.source_type = p_source_type
      AND r.entity_id = p_entity_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Der er allerede indberettet en fejl for dette');
  END IF;

  INSERT INTO public.result_error_reports (
    reporter_id,
    source_type,
    entity_id,
    reason,
    details,
    entity_completed_at,
    status
  )
  VALUES (
    v_caller,
    p_source_type,
    p_entity_id,
    p_reason,
    v_details,
    v_completed_at,
    'open'
  );

  SELECT coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(name), ''),
    'En spiller'
  )
  INTO v_reporter_name
  FROM public.profiles
  WHERE id = v_caller;

  v_reason_label := CASE p_reason
    WHEN 'elo' THEN 'ELO'
    WHEN 'points' THEN 'Point'
    WHEN 'result' THEN 'Resultat'
    ELSE 'Andet'
  END;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT
        p.id,
        'result_error_report',
        'Fejl indberettet',
        format(
          '%s indberettede fejl (%s) på %s. Gå til Admin → Fejl.',
          v_reporter_name,
          v_reason_label,
          v_entity_label
        ),
        CASE WHEN p_source_type = 'match_2v2' THEN p_entity_id ELSE NULL END,
        false
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin';
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notify_title', 'Fejl indberettet',
    'notify_body', format(
      '%s indberettede fejl (%s) på %s. Gå til Admin → Fejl.',
      v_reporter_name,
      v_reason_label,
      v_entity_label
    ),
    'admin_ids', (
      SELECT coalesce(jsonb_agg(p.id), '[]'::jsonb)
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin'
    )
  );
END;
$$;


ALTER FUNCTION "public"."submit_result_error_report"("p_source_type" "text", "p_entity_id" "uuid", "p_reason" "text", "p_details" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_americano_elo_history_sync_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  uid uuid;
BEGIN
  IF COALESCE(current_setting('app.skip_americano_elo_sync', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  uid := COALESCE(NEW.user_id, OLD.user_id);
  IF uid IS NOT NULL THEN
    PERFORM public.recalc_americano_elo_from_history(uid);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_americano_elo_history_sync_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_americano_match_recalc_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE uid uuid;
BEGIN
  FOR uid IN
    SELECT DISTINCT ap.user_id FROM public.americano_participants ap
    WHERE ap.tournament_id IN (SELECT DISTINCT tournament_id FROM changed_rows)
  LOOP PERFORM public.recalc_americano_profile_stats(uid); END LOOP;
  RETURN NULL;
END; $$;


ALTER FUNCTION "public"."trg_americano_match_recalc_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_elo_history_auto_flag_match"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  IF NEW.match_id IS NOT NULL THEN
    BEGIN
      PERFORM public.detect_and_flag_suspicious_2v2_match(NEW.match_id);
    EXCEPTION
      WHEN OTHERS THEN
        -- Flagging maa aldrig stoppe selve ELO-opdateringen.
        NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_elo_history_auto_flag_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_elo_history_sync_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE uid uuid;
BEGIN
  IF tg_op='DELETE' THEN uid:=OLD.user_id; ELSE uid:=NEW.user_id; END IF;
  IF uid IS NOT NULL THEN PERFORM public.recalc_profile_stats_from_elo_history(uid); END IF;
  IF tg_op='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."trg_elo_history_sync_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_americano_elo_history_engine_meta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  IF NEW.rating_engine IS NULL OR btrim(NEW.rating_engine) = '' THEN
    NEW.rating_engine := 'americano_elo_v1_dynamic_k';
  END IF;

  IF NEW.rating_meta IS NULL THEN
    NEW.rating_meta := '{}'::jsonb;
  END IF;

  NEW.rating_meta := jsonb_strip_nulls(
    COALESCE(NEW.rating_meta, '{}'::jsonb)
    || jsonb_build_object(
      'mode', 'americano',
      'source', 'apply_americano_elo_for_tournament'
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_set_americano_elo_history_engine_meta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_elo_history_engine_meta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
BEGIN
  IF NEW.rating_engine IS NULL OR btrim(NEW.rating_engine) = '' THEN
    IF NEW.match_id IS NOT NULL THEN
      NEW.rating_engine := 'elo_v2_individual_expected_zero_sum_v1';
    ELSIF lower(COALESCE(NEW.result, '')) = 'admin_adjust' THEN
      NEW.rating_engine := 'elo_admin_adjust_v1';
    ELSE
      NEW.rating_engine := 'legacy_unknown';
    END IF;
  END IF;

  IF NEW.rating_meta IS NULL THEN
    NEW.rating_meta := '{}'::jsonb;
  END IF;

  IF NEW.match_id IS NOT NULL THEN
    NEW.rating_meta := jsonb_strip_nulls(
      COALESCE(NEW.rating_meta, '{}'::jsonb)
      || jsonb_build_object(
        'mode', '2v2',
        'source', 'apply_elo_for_match_core'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_set_elo_history_engine_meta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_form_match_proposal"("p_seed_intent_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_seed public.play_intents%ROWTYPE;
  v_row record;
  v_sel_ids uuid[] := '{}';
  v_sel_users uuid[] := '{}';
  v_sel_lat double precision[] := '{}';
  v_sel_lon double precision[] := '{}';
  v_start time;
  v_end time;
  v_cand_start time;
  v_cand_end time;
  v_ok boolean;
  v_i integer;
  v_km double precision;
  v_proposal_id uuid;
  v_expires timestamptz;
  v_title text;
  v_body text;
  v_uid uuid;
  v_radius_km constant double precision := 40;
  v_min_overlap constant interval := interval '90 minutes';
  v_level_tol constant numeric := 1.2;
  v_needed constant integer := 4;
BEGIN
  SELECT * INTO v_seed FROM public.play_intents WHERE id = p_seed_intent_id;
  IF NOT FOUND OR v_seed.status <> 'open' THEN
    RETURN jsonb_build_object('ok', true, 'formed', false, 'reason', 'seed_unavailable');
  END IF;

  v_sel_ids := ARRAY[v_seed.id];
  v_sel_users := ARRAY[v_seed.user_id];
  v_sel_lat := ARRAY[v_seed.latitude];
  v_sel_lon := ARRAY[v_seed.longitude];
  v_start := v_seed.start_time;
  v_end := v_seed.end_time;

  FOR v_row IN
    SELECT i.*
    FROM public.play_intents i
    JOIN public.profiles p ON p.id = i.user_id
    WHERE i.status = 'open'
      AND i.play_date = v_seed.play_date
      AND i.user_id <> v_seed.user_id
      AND COALESCE(p.is_banned, false) = false
      AND i.start_time < v_seed.end_time
      AND i.end_time > v_seed.start_time
      AND (
        v_seed.level IS NULL OR i.level IS NULL
        OR abs(i.level - v_seed.level) <= v_level_tol
      )
      AND (
        (i.latitude IS NOT NULL AND v_seed.latitude IS NOT NULL)
        OR (v_seed.region <> '' AND i.region = v_seed.region)
      )
    ORDER BY i.created_at
  LOOP
    EXIT WHEN array_length(v_sel_ids, 1) >= v_needed;

    IF v_row.user_id = ANY (v_sel_users) THEN
      CONTINUE;
    END IF;

    v_cand_start := GREATEST(v_start, v_row.start_time);
    v_cand_end := LEAST(v_end, v_row.end_time);
    IF (v_cand_end - v_cand_start) < v_min_overlap THEN
      CONTINUE;
    END IF;

    v_ok := true;
    FOR v_i IN 1 .. array_length(v_sel_ids, 1) LOOP
      IF v_sel_lat[v_i] IS NULL OR v_row.latitude IS NULL THEN
        CONTINUE;
      END IF;
      v_km := public.haversine_km(v_sel_lat[v_i], v_sel_lon[v_i], v_row.latitude, v_row.longitude);
      IF v_km > v_radius_km THEN
        v_ok := false;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_ok THEN
      CONTINUE;
    END IF;

    v_sel_ids := array_append(v_sel_ids, v_row.id);
    v_sel_users := array_append(v_sel_users, v_row.user_id);
    v_sel_lat := array_append(v_sel_lat, v_row.latitude);
    v_sel_lon := array_append(v_sel_lon, v_row.longitude);
    v_start := v_cand_start;
    v_end := v_cand_end;
  END LOOP;

  IF array_length(v_sel_ids, 1) < v_needed THEN
    RETURN jsonb_build_object(
      'ok', true,
      'formed', false,
      'reason', 'not_enough',
      'pool_size', array_length(v_sel_ids, 1)
    );
  END IF;

  v_expires := LEAST(
    now() + interval '24 hours',
    ((v_seed.play_date + v_start) AT TIME ZONE 'Europe/Copenhagen') - interval '2 hours'
  );
  IF v_expires <= now() THEN
    v_expires := now() + interval '30 minutes';
  END IF;

  INSERT INTO public.match_proposals (play_date, start_time, end_time, region, expires_at)
  VALUES (v_seed.play_date, v_start, v_end, v_seed.region, v_expires)
  RETURNING id INTO v_proposal_id;

  INSERT INTO public.match_proposal_members (proposal_id, user_id, intent_id)
  SELECT v_proposal_id, i.user_id, i.id
  FROM public.play_intents i
  WHERE i.id = ANY (v_sel_ids);

  UPDATE public.play_intents
  SET status = 'proposed', proposal_id = v_proposal_id
  WHERE id = ANY (v_sel_ids);

  v_title := 'I er 4 — bekræft jeres kamp';
  v_body := format(
    '%s kl. %s-%s%s · Bekræft inden %s',
    to_char(v_seed.play_date, 'DD/MM'),
    to_char(v_start, 'HH24:MI'),
    to_char(v_end, 'HH24:MI'),
    CASE WHEN v_seed.region <> '' THEN ' · ' || v_seed.region ELSE '' END,
    to_char(v_expires AT TIME ZONE 'Europe/Copenhagen', 'DD/MM HH24:MI')
  );

  FOREACH v_uid IN ARRAY v_sel_users LOOP
    INSERT INTO public.notifications
      (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES
      (v_uid, 'match_proposal', v_title, v_body, NULL, 'match_proposal', v_proposal_id, false);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'formed', true,
    'proposal_id', v_proposal_id,
    'play_date', v_seed.play_date,
    'start_time', to_char(v_start, 'HH24:MI'),
    'end_time', to_char(v_end, 'HH24:MI'),
    'member_ids', to_jsonb(v_sel_users)
  );
END;
$$;


ALTER FUNCTION "public"."try_form_match_proposal"("p_seed_intent_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  DELETE FROM public.user_blocks
  WHERE blocker_id = v_caller AND blocked_id = p_blocked_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_phone_verification_exempt"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT p.phone_verification_exempt
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;


ALTER FUNCTION "public"."user_is_phone_verification_exempt"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_user_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_pin_sessions" (
    "user_id" "uuid" NOT NULL,
    "verified_until" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_pin_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_pin_settings" (
    "user_id" "uuid" NOT NULL,
    "pin_hash" "text" NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "lock_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_pin_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."americano_elo_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "old_rating" integer NOT NULL,
    "new_rating" integer NOT NULL,
    "change" integer NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "placement" integer NOT NULL,
    "participant_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rating_engine" "text" DEFAULT 'americano_elo_v1_dynamic_k'::"text" NOT NULL,
    "rating_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."americano_elo_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."americano_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "round_number" integer NOT NULL,
    "court_index" integer DEFAULT 0 NOT NULL,
    "team_a_p1" "uuid" NOT NULL,
    "team_a_p2" "uuid" NOT NULL,
    "team_b_p1" "uuid" NOT NULL,
    "team_b_p2" "uuid" NOT NULL,
    "team_a_score" integer,
    "team_b_score" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "results_locked" boolean DEFAULT false NOT NULL,
    CONSTRAINT "americano_matches_players_distinct" CHECK ((("team_a_p1" <> "team_a_p2") AND ("team_a_p1" <> "team_b_p1") AND ("team_a_p1" <> "team_b_p2") AND ("team_a_p2" <> "team_b_p1") AND ("team_a_p2" <> "team_b_p2") AND ("team_b_p1" <> "team_b_p2"))),
    CONSTRAINT "americano_matches_round_number_check" CHECK (("round_number" >= 1))
);


ALTER TABLE "public"."americano_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."americano_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."americano_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."americano_tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "tournament_date" "date" NOT NULL,
    "time_slot" "text" DEFAULT '18:00'::"text" NOT NULL,
    "court_id" "uuid",
    "player_slots" integer NOT NULL,
    "points_per_match" integer NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'registration'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "opponent_passes" integer DEFAULT 1 NOT NULL,
    "completed_at" timestamp with time zone,
    "format" "text" DEFAULT 'americano'::"text" NOT NULL,
    "courts_per_round" integer DEFAULT 1 NOT NULL,
    "price_per_person" integer DEFAULT 0,
    "payment_method" "text" DEFAULT 'mobilepay'::"text",
    "registration_deadline_type" "text" DEFAULT 'day_before_noon'::"text",
    "is_public" boolean DEFAULT true,
    "has_waitlist" boolean DEFAULT true,
    "enforce_level_interval" boolean DEFAULT false,
    "level_min" numeric DEFAULT 1.0,
    "level_max" numeric DEFAULT 5.0,
    "duration_minutes" integer DEFAULT 120,
    CONSTRAINT "americano_tournaments_courts_per_round_check" CHECK ((("courts_per_round" >= 1) AND ("courts_per_round" <= ("player_slots" / 4)))),
    CONSTRAINT "americano_tournaments_format_check" CHECK (("format" = ANY (ARRAY['americano'::"text", 'mexicano'::"text"]))),
    CONSTRAINT "americano_tournaments_opponent_passes_check" CHECK (("opponent_passes" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "americano_tournaments_player_slots_check" CHECK ((("player_slots" >= 4) AND ("player_slots" <= 16))),
    CONSTRAINT "americano_tournaments_points_per_match_check" CHECK (("points_per_match" = ANY (ARRAY[16, 24, 32]))),
    CONSTRAINT "americano_tournaments_status_check" CHECK (("status" = ANY (ARRAY['registration'::"text", 'playing'::"text", 'completed'::"text"]))),
    CONSTRAINT "americano_tournaments_time_slot_format" CHECK (("time_slot" ~ '^\d{2}:\d{2}$'::"text"))
);


ALTER TABLE "public"."americano_tournaments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."americano_tournaments"."format" IS 'americano: forudgenereret rotation. mexicano: næste runde bygges ud fra stilling (1+4 vs 2+3 på banen).';



COMMENT ON COLUMN "public"."americano_tournaments"."courts_per_round" IS 'Antal parallelle baner pr. runde. 1 = klassisk. Maks floor(player_slots/4).';



CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "court_id" "uuid",
    "court_name" "text",
    "date" "date" NOT NULL,
    "time_slot" "text" NOT NULL,
    "price" integer,
    "status" "text" DEFAULT 'confirmed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_id" "uuid",
    "date" "date" NOT NULL,
    "time" "text" NOT NULL,
    "is_booked" boolean DEFAULT false,
    "booked_by" "uuid"
);


ALTER TABLE "public"."court_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text" NOT NULL,
    "latitude" real,
    "longitude" real,
    "price_per_hour" integer NOT NULL,
    "is_indoor" boolean DEFAULT true,
    "rating" real DEFAULT 4.0,
    "image_url" "text",
    "booking_url" "text",
    "booking_provider" "text",
    "facilities" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."courts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."courts"."booking_url" IS 'Ekstern booking-URL (åbnes i ny fane), fx Halbooking.';



COMMENT ON COLUMN "public"."courts"."booking_provider" IS 'Valgfrit: halbooking_ntsc = åbn NTSC Halbooking; ellers bruger appen navn/adresse-match.';



CREATE TABLE IF NOT EXISTS "public"."deleted_players_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid",
    "old_user_id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "reason" "text",
    "profile_snapshot" "jsonb" NOT NULL,
    "auth_snapshot" "jsonb",
    "restored_at" timestamp with time zone,
    "restored_by" "uuid",
    "restored_user_id" "uuid"
);


ALTER TABLE "public"."deleted_players_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."elo_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "match_id" "uuid",
    "old_rating" real,
    "new_rating" real,
    "change" real,
    "result" "text",
    "date" "date" DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rating_engine" "text" DEFAULT 'elo_v2_individual_expected_zero_sum_v1'::"text" NOT NULL,
    "rating_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "elo_history_result_check" CHECK (("result" = ANY (ARRAY['win'::"text", 'loss'::"text", 'draw'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."elo_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."glicko2_shadow_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "old_rating" numeric(10,4) NOT NULL,
    "new_rating" numeric(10,4) NOT NULL,
    "old_rd" numeric(10,4) NOT NULL,
    "new_rd" numeric(10,4) NOT NULL,
    "old_volatility" numeric(10,6) NOT NULL,
    "new_volatility" numeric(10,6) NOT NULL,
    "expected" numeric(10,6) NOT NULL,
    "outcome" numeric(3,1) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."glicko2_shadow_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."glicko2_shadow_ratings" (
    "user_id" "uuid" NOT NULL,
    "rating" numeric(10,4) DEFAULT 1500 NOT NULL,
    "rd" numeric(10,4) DEFAULT 350 NOT NULL,
    "volatility" numeric(10,6) DEFAULT 0.06 NOT NULL,
    "games_played" integer DEFAULT 0 NOT NULL,
    "last_match_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."glicko2_shadow_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."growth_campaign_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entry_number" integer NOT NULL,
    "qualified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_consent_at" timestamp with time zone,
    CONSTRAINT "growth_campaign_entries_entry_number_check" CHECK (("entry_number" > 0))
);


ALTER TABLE "public"."growth_campaign_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."growth_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "prize_description" "text" DEFAULT ''::"text" NOT NULL,
    "max_entries" integer NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "draw_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "rules_version" "text" DEFAULT '1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "winner_user_id" "uuid",
    "winner_entry_number" integer,
    "drawn_by" "uuid",
    CONSTRAINT "growth_campaigns_max_entries_check" CHECK (("max_entries" > 0)),
    CONSTRAINT "growth_campaigns_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'drawn'::"text"]))),
    CONSTRAINT "growth_campaigns_winner_entry_number_check" CHECK ((("winner_entry_number" IS NULL) OR ("winner_entry_number" > 0)))
);


ALTER TABLE "public"."growth_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "round_number" integer DEFAULT 1 NOT NULL,
    "team1_id" "uuid" NOT NULL,
    "team2_id" "uuid",
    "winner_id" "uuid",
    "score_text" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reported_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "league_matches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reported'::"text"])))
);


ALTER TABLE "public"."league_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "player1_id" "uuid" NOT NULL,
    "player2_id" "uuid" NOT NULL,
    "player1_name" "text" NOT NULL,
    "player2_name" "text" NOT NULL,
    "player1_avatar" "text",
    "player2_avatar" "text",
    "elo_combined" integer DEFAULT 2000 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "division" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "league_teams_check" CHECK (("player1_id" <> "player2_id")),
    CONSTRAINT "league_teams_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ready'::"text"])))
);


ALTER TABLE "public"."league_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leagues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "season_type" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "status" "text" DEFAULT 'registration'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "current_round" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "max_teams" integer,
    "total_rounds" integer,
    "completed_at" timestamp with time zone,
    "num_divisions" integer DEFAULT 1,
    "registration_deadline" "date",
    "match_system" "text" DEFAULT 'round_robin'::"text",
    "points_win" integer DEFAULT 3,
    "points_draw" integer DEFAULT 1,
    "points_loss" integer DEFAULT 0,
    "promotion_spots" integer DEFAULT 2,
    "relegation_spots" integer DEFAULT 2,
    "rules_notes" "text",
    "region" "text",
    CONSTRAINT "leagues_season_type_check" CHECK (("season_type" = ANY (ARRAY['weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "leagues_status_check" CHECK (("status" = ANY (ARRAY['registration'::"text", 'active'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."leagues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text",
    "user_emoji" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "match_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."match_join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_name" "text" DEFAULT ''::"text" NOT NULL,
    "sender_avatar" "text",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_messages_content_len_chk" CHECK ((("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 1000)))
);


ALTER TABLE "public"."match_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid",
    "user_id" "uuid",
    "user_name" "text",
    "user_email" "text",
    "user_emoji" "text" DEFAULT '🎾'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "team" integer,
    "court_side" "text",
    CONSTRAINT "match_players_court_side_check" CHECK ((("court_side" IS NULL) OR ("court_side" = ANY (ARRAY['left'::"text", 'right'::"text"])))),
    CONSTRAINT "match_players_team_check" CHECK (("team" = ANY (ARRAY[1, 2])))
);


ALTER TABLE "public"."match_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_proposal_members" (
    "proposal_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "intent_id" "uuid",
    "response" "text" DEFAULT 'pending'::"text" NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "match_proposal_members_response_check" CHECK (("response" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."match_proposal_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "play_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "region" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "match_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'declined'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."match_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid",
    "team1_player1_id" "uuid",
    "team1_player2_id" "uuid",
    "team2_player1_id" "uuid",
    "team2_player2_id" "uuid",
    "team1_player1_email" "text",
    "team1_player2_email" "text",
    "team2_player1_email" "text",
    "team2_player2_email" "text",
    "team1_player1_name" "text",
    "team1_player2_name" "text",
    "team2_player1_name" "text",
    "team2_player2_name" "text",
    "set1_team1" integer,
    "set1_team2" integer,
    "set2_team1" integer,
    "set2_team2" integer,
    "set3_team1" integer,
    "set3_team2" integer,
    "sets_won_team1" integer,
    "sets_won_team2" integer,
    "match_winner" "text",
    "score_display" "text",
    "submitted_by" "uuid",
    "submitted_by_email" "text",
    "confirmed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "confirmed_by" "uuid",
    "set1_tb1" integer,
    "set1_tb2" integer,
    "set2_tb1" integer,
    "set2_tb2" integer,
    "set3_tb1" integer,
    "set3_tb2" integer,
    CONSTRAINT "match_results_match_winner_check" CHECK (("match_winner" = ANY (ARRAY['team1'::"text", 'team2'::"text"])))
);


ALTER TABLE "public"."match_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "creator_id" "uuid",
    "court_id" "uuid",
    "court_name" "text",
    "date" "date" NOT NULL,
    "time" "text" NOT NULL,
    "level_range" "text" DEFAULT '4-6'::"text",
    "max_players" integer DEFAULT 4,
    "current_players" integer DEFAULT 1,
    "status" "text" DEFAULT 'open'::"text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "time_end" "text",
    "started_by" "uuid",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "seeking_player" boolean DEFAULT false NOT NULL,
    "seeking_player_notified_at" timestamp with time zone,
    "match_type" "text" DEFAULT 'open'::"text",
    "price_per_person" numeric(7,2),
    "payment_method" "text",
    CONSTRAINT "matches_match_type_check" CHECK (("match_type" = ANY (ARRAY['open'::"text", 'closed'::"text"]))),
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'full'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'active'::"text"])))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "match_id" "uuid",
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."play_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "play_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "region" "text" DEFAULT ''::"text" NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "level" numeric,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "proposal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "play_intents_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'proposed'::"text", 'matched'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "play_intents_window_valid" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."play_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_hits" (
    "key" "text" NOT NULL,
    "window_start" bigint NOT NULL,
    "hits" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."rate_limit_hits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rating_admin_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "match_id" "uuid",
    "tournament_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    CONSTRAINT "rating_admin_flags_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "rating_admin_flags_source_check" CHECK (("source" = ANY (ARRAY['2v2'::"text", 'americano'::"text"]))),
    CONSTRAINT "rating_admin_flags_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewed'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."rating_admin_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactivation_log" (
    "user_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'open_matches_weekly'::"text" NOT NULL,
    "week_start" "date" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reactivation_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."reactivation_log" IS 'Dedup-log for ugentlige genaktiverings-push til sovende profiler (0 kampe).';



CREATE TABLE IF NOT EXISTS "public"."reminder_log" (
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reminder_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."result_error_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "entity_completed_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "result_error_reports_reason_chk" CHECK (("reason" = ANY (ARRAY['elo'::"text", 'points'::"text", 'result'::"text", 'other'::"text"]))),
    CONSTRAINT "result_error_reports_source_chk" CHECK (("source_type" = ANY (ARRAY['match_2v2'::"text", 'americano'::"text", 'league'::"text"]))),
    CONSTRAINT "result_error_reports_status_chk" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."result_error_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_blocks_no_self" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."user_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_favorites" (
    "user_id" "uuid" NOT NULL,
    "favorite_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_favorites_no_self" CHECK (("user_id" <> "favorite_id"))
);


ALTER TABLE "public"."user_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "context" "text" DEFAULT 'dm'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "user_reports_no_self" CHECK (("reporter_id" <> "reported_id")),
    CONSTRAINT "user_reports_reason_chk" CHECK (("reason" = ANY (ARRAY['harassment'::"text", 'spam'::"text", 'inappropriate'::"text", 'other'::"text"]))),
    CONSTRAINT "user_reports_status_chk" CHECK (("status" = ANY (ARRAY['open'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_pin_sessions"
    ADD CONSTRAINT "admin_pin_sessions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."admin_pin_settings"
    ADD CONSTRAINT "admin_pin_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."americano_elo_history"
    ADD CONSTRAINT "americano_elo_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."americano_elo_history"
    ADD CONSTRAINT "americano_elo_history_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."americano_matches"
    ADD CONSTRAINT "americano_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."americano_participants"
    ADD CONSTRAINT "americano_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."americano_participants"
    ADD CONSTRAINT "americano_participants_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."americano_tournaments"
    ADD CONSTRAINT "americano_tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_slots"
    ADD CONSTRAINT "court_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deleted_players_archive"
    ADD CONSTRAINT "deleted_players_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."elo_history"
    ADD CONSTRAINT "elo_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."glicko2_shadow_history"
    ADD CONSTRAINT "glicko2_shadow_history_match_id_user_id_key" UNIQUE ("match_id", "user_id");



ALTER TABLE ONLY "public"."glicko2_shadow_history"
    ADD CONSTRAINT "glicko2_shadow_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."glicko2_shadow_ratings"
    ADD CONSTRAINT "glicko2_shadow_ratings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."growth_campaign_entries"
    ADD CONSTRAINT "growth_campaign_entries_campaign_id_entry_number_key" UNIQUE ("campaign_id", "entry_number");



ALTER TABLE ONLY "public"."growth_campaign_entries"
    ADD CONSTRAINT "growth_campaign_entries_campaign_id_user_id_key" UNIQUE ("campaign_id", "user_id");



ALTER TABLE ONLY "public"."growth_campaign_entries"
    ADD CONSTRAINT "growth_campaign_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."growth_campaigns"
    ADD CONSTRAINT "growth_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."growth_campaigns"
    ADD CONSTRAINT "growth_campaigns_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."league_matches"
    ADD CONSTRAINT "league_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_team_messages"
    ADD CONSTRAINT "league_team_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_league_id_player1_id_key" UNIQUE ("league_id", "player1_id");



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_league_id_player2_id_key" UNIQUE ("league_id", "player2_id");



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_join_requests"
    ADD CONSTRAINT "match_join_requests_match_id_user_id_key" UNIQUE ("match_id", "user_id");



ALTER TABLE ONLY "public"."match_join_requests"
    ADD CONSTRAINT "match_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_messages"
    ADD CONSTRAINT "match_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_photos"
    ADD CONSTRAINT "match_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_match_id_user_id_key" UNIQUE ("match_id", "user_id");



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_proposal_members"
    ADD CONSTRAINT "match_proposal_members_pkey" PRIMARY KEY ("proposal_id", "user_id");



ALTER TABLE ONLY "public"."match_proposals"
    ADD CONSTRAINT "match_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."play_intents"
    ADD CONSTRAINT "play_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_hits"
    ADD CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("key", "window_start");



ALTER TABLE ONLY "public"."rating_admin_flags"
    ADD CONSTRAINT "rating_admin_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactivation_log"
    ADD CONSTRAINT "reactivation_log_pkey" PRIMARY KEY ("user_id", "kind", "week_start");



ALTER TABLE ONLY "public"."reminder_log"
    ADD CONSTRAINT "reminder_log_pkey" PRIMARY KEY ("entity_type", "entity_id", "kind", "user_id");



ALTER TABLE ONLY "public"."result_error_reports"
    ADD CONSTRAINT "result_error_reports_entity_unique" UNIQUE ("source_type", "entity_id");



ALTER TABLE ONLY "public"."result_error_reports"
    ADD CONSTRAINT "result_error_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_unique_pair" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("user_id", "favorite_id");



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_audit_log_actor_id_idx" ON "public"."admin_audit_log" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "admin_audit_log_created_at_idx" ON "public"."admin_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_audit_log_target_user_id" ON "public"."admin_audit_log" USING "btree" ("target_user_id");



CREATE INDEX "idx_americano_elo_history_tournament" ON "public"."americano_elo_history" USING "btree" ("tournament_id");



CREATE INDEX "idx_americano_elo_history_user_created" ON "public"."americano_elo_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_americano_matches_round" ON "public"."americano_matches" USING "btree" ("tournament_id", "round_number");



CREATE INDEX "idx_americano_matches_team_a_p1" ON "public"."americano_matches" USING "btree" ("team_a_p1");



CREATE INDEX "idx_americano_matches_team_a_p2" ON "public"."americano_matches" USING "btree" ("team_a_p2");



CREATE INDEX "idx_americano_matches_team_b_p1" ON "public"."americano_matches" USING "btree" ("team_b_p1");



CREATE INDEX "idx_americano_matches_team_b_p2" ON "public"."americano_matches" USING "btree" ("team_b_p2");



CREATE INDEX "idx_americano_matches_tournament" ON "public"."americano_matches" USING "btree" ("tournament_id");



CREATE INDEX "idx_americano_participants_tournament" ON "public"."americano_participants" USING "btree" ("tournament_id");



CREATE INDEX "idx_americano_participants_user_id" ON "public"."americano_participants" USING "btree" ("user_id");



CREATE INDEX "idx_americano_tournaments_completed_at" ON "public"."americano_tournaments" USING "btree" ("completed_at") WHERE ("status" = 'completed'::"text");



CREATE INDEX "idx_americano_tournaments_court_id" ON "public"."americano_tournaments" USING "btree" ("court_id");



CREATE INDEX "idx_americano_tournaments_creator" ON "public"."americano_tournaments" USING "btree" ("creator_id");



CREATE INDEX "idx_americano_tournaments_date" ON "public"."americano_tournaments" USING "btree" ("tournament_date");



CREATE INDEX "idx_bookings_court_id" ON "public"."bookings" USING "btree" ("court_id");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_court_slots_booked_by" ON "public"."court_slots" USING "btree" ("booked_by");



CREATE INDEX "idx_court_slots_court_id" ON "public"."court_slots" USING "btree" ("court_id");



CREATE INDEX "idx_deleted_players_archive_deleted_at" ON "public"."deleted_players_archive" USING "btree" ("deleted_at" DESC);



CREATE INDEX "idx_deleted_players_archive_deleted_by" ON "public"."deleted_players_archive" USING "btree" ("deleted_by");



CREATE INDEX "idx_deleted_players_archive_old_user_id" ON "public"."deleted_players_archive" USING "btree" ("old_user_id");



CREATE INDEX "idx_deleted_players_archive_restored_by" ON "public"."deleted_players_archive" USING "btree" ("restored_by");



CREATE INDEX "idx_deleted_players_archive_restored_user_id" ON "public"."deleted_players_archive" USING "btree" ("restored_user_id");



CREATE INDEX "idx_elo_history_match_id" ON "public"."elo_history" USING "btree" ("match_id");



CREATE INDEX "idx_elo_history_user_id" ON "public"."elo_history" USING "btree" ("user_id");



CREATE INDEX "idx_glicko2_shadow_history_match" ON "public"."glicko2_shadow_history" USING "btree" ("match_id");



CREATE INDEX "idx_glicko2_shadow_history_user_created" ON "public"."glicko2_shadow_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_growth_campaign_entries_campaign" ON "public"."growth_campaign_entries" USING "btree" ("campaign_id", "entry_number");



CREATE INDEX "idx_growth_campaign_entries_user" ON "public"."growth_campaign_entries" USING "btree" ("user_id");



CREATE INDEX "idx_growth_campaigns_drawn_by" ON "public"."growth_campaigns" USING "btree" ("drawn_by");



CREATE INDEX "idx_growth_campaigns_winner" ON "public"."growth_campaigns" USING "btree" ("winner_user_id") WHERE ("winner_user_id" IS NOT NULL);



CREATE INDEX "idx_league_matches_league" ON "public"."league_matches" USING "btree" ("league_id");



CREATE INDEX "idx_league_matches_reported_by" ON "public"."league_matches" USING "btree" ("reported_by");



CREATE INDEX "idx_league_matches_status" ON "public"."league_matches" USING "btree" ("status");



CREATE INDEX "idx_league_matches_team1_id" ON "public"."league_matches" USING "btree" ("team1_id");



CREATE INDEX "idx_league_matches_team2_id" ON "public"."league_matches" USING "btree" ("team2_id");



CREATE INDEX "idx_league_matches_winner_id" ON "public"."league_matches" USING "btree" ("winner_id");



CREATE INDEX "idx_league_team_messages_league_id" ON "public"."league_team_messages" USING "btree" ("league_id");



CREATE INDEX "idx_league_team_messages_sender_id" ON "public"."league_team_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_league_team_messages_team_created" ON "public"."league_team_messages" USING "btree" ("team_id", "created_at");



CREATE INDEX "idx_league_teams_league_id" ON "public"."league_teams" USING "btree" ("league_id");



CREATE INDEX "idx_league_teams_player1" ON "public"."league_teams" USING "btree" ("player1_id");



CREATE INDEX "idx_league_teams_player2" ON "public"."league_teams" USING "btree" ("player2_id");



CREATE INDEX "idx_leagues_completed_at" ON "public"."leagues" USING "btree" ("completed_at") WHERE ("status" = 'completed'::"text");



CREATE INDEX "idx_leagues_created_by" ON "public"."leagues" USING "btree" ("created_by");



CREATE INDEX "idx_leagues_status" ON "public"."leagues" USING "btree" ("status");



CREATE INDEX "idx_match_join_requests_match_id" ON "public"."match_join_requests" USING "btree" ("match_id");



CREATE INDEX "idx_match_join_requests_match_pending" ON "public"."match_join_requests" USING "btree" ("match_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_match_join_requests_user_id" ON "public"."match_join_requests" USING "btree" ("user_id");



CREATE INDEX "idx_match_messages_match_id_created_at" ON "public"."match_messages" USING "btree" ("match_id", "created_at");



CREATE INDEX "idx_match_messages_sender_id" ON "public"."match_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_match_photos_user_id" ON "public"."match_photos" USING "btree" ("user_id");



CREATE INDEX "idx_match_players_match_id" ON "public"."match_players" USING "btree" ("match_id");



CREATE INDEX "idx_match_players_user_id" ON "public"."match_players" USING "btree" ("user_id");



CREATE INDEX "idx_match_proposal_members_intent_id" ON "public"."match_proposal_members" USING "btree" ("intent_id");



CREATE INDEX "idx_match_proposals_match_id" ON "public"."match_proposals" USING "btree" ("match_id");



CREATE INDEX "idx_match_results_confirmed_by" ON "public"."match_results" USING "btree" ("confirmed_by");



CREATE INDEX "idx_match_results_match_id" ON "public"."match_results" USING "btree" ("match_id");



CREATE INDEX "idx_match_results_submitted_by" ON "public"."match_results" USING "btree" ("submitted_by");



CREATE INDEX "idx_match_results_team1_player1_id" ON "public"."match_results" USING "btree" ("team1_player1_id");



CREATE INDEX "idx_match_results_team1_player2_id" ON "public"."match_results" USING "btree" ("team1_player2_id");



CREATE INDEX "idx_match_results_team2_player1_id" ON "public"."match_results" USING "btree" ("team2_player1_id");



CREATE INDEX "idx_match_results_team2_player2_id" ON "public"."match_results" USING "btree" ("team2_player2_id");



CREATE INDEX "idx_matches_court_id" ON "public"."matches" USING "btree" ("court_id");



CREATE INDEX "idx_matches_creator_id" ON "public"."matches" USING "btree" ("creator_id");



CREATE INDEX "idx_matches_seeking_player" ON "public"."matches" USING "btree" ("seeking_player") WHERE ("seeking_player" = true);



CREATE INDEX "idx_matches_started_by" ON "public"."matches" USING "btree" ("started_by");



CREATE INDEX "idx_matches_status_date" ON "public"."matches" USING "btree" ("status", "date");



CREATE INDEX "idx_messages_receiver_sender_created_at" ON "public"."messages" USING "btree" ("receiver_id", "sender_id", "created_at" DESC);



CREATE INDEX "idx_messages_receiver_sender_unread" ON "public"."messages" USING "btree" ("receiver_id", "sender_id") WHERE ("is_read" = false);



CREATE INDEX "idx_messages_sender_receiver_created_at" ON "public"."messages" USING "btree" ("sender_id", "receiver_id", "created_at" DESC);



CREATE INDEX "idx_notifications_match_id" ON "public"."notifications" USING "btree" ("match_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_type_created" ON "public"."notifications" USING "btree" ("user_id", "type", "created_at" DESC);



CREATE INDEX "idx_profiles_last_active_at" ON "public"."profiles" USING "btree" ("last_active_at" DESC NULLS LAST);



CREATE INDEX "idx_profiles_makker_watch_active" ON "public"."profiles" USING "btree" ("makker_watch_enabled") WHERE (("makker_watch_enabled" = true) AND (COALESCE("is_banned", false) = false));



CREATE INDEX "idx_profiles_match_watch_active" ON "public"."profiles" USING "btree" ("match_watch_enabled") WHERE (("match_watch_enabled" = true) AND (COALESCE("is_banned", false) = false));



CREATE INDEX "idx_profiles_seeking_match" ON "public"."profiles" USING "btree" ("seeking_match") WHERE (("seeking_match" = true) AND ("is_banned" = false));



CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_rating_admin_flags_match" ON "public"."rating_admin_flags" USING "btree" ("match_id");



CREATE INDEX "idx_rating_admin_flags_reviewed_by" ON "public"."rating_admin_flags" USING "btree" ("reviewed_by");



CREATE INDEX "idx_rating_admin_flags_status_created" ON "public"."rating_admin_flags" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_rating_admin_flags_tournament" ON "public"."rating_admin_flags" USING "btree" ("tournament_id");



CREATE UNIQUE INDEX "idx_rating_admin_flags_unique_match_reason" ON "public"."rating_admin_flags" USING "btree" ("source", "reason", "match_id") WHERE ("match_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_rating_admin_flags_unique_tournament_reason" ON "public"."rating_admin_flags" USING "btree" ("source", "reason", "tournament_id") WHERE ("tournament_id" IS NOT NULL);



CREATE INDEX "idx_result_error_reports_reporter" ON "public"."result_error_reports" USING "btree" ("reporter_id", "created_at" DESC);



CREATE INDEX "idx_result_error_reports_resolved_by" ON "public"."result_error_reports" USING "btree" ("resolved_by");



CREATE INDEX "idx_result_error_reports_status_created" ON "public"."result_error_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_user_blocks_blocked" ON "public"."user_blocks" USING "btree" ("blocked_id");



CREATE INDEX "idx_user_blocks_blocker" ON "public"."user_blocks" USING "btree" ("blocker_id");



CREATE INDEX "idx_user_favorites_favorite" ON "public"."user_favorites" USING "btree" ("favorite_id");



CREATE INDEX "idx_user_reports_reported" ON "public"."user_reports" USING "btree" ("reported_id", "created_at" DESC);



CREATE INDEX "idx_user_reports_reporter_id" ON "public"."user_reports" USING "btree" ("reporter_id");



CREATE INDEX "idx_user_reports_resolved_by" ON "public"."user_reports" USING "btree" ("resolved_by");



CREATE INDEX "idx_user_reports_status_created" ON "public"."user_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "match_photos_match_id_idx" ON "public"."match_photos" USING "btree" ("match_id");



CREATE UNIQUE INDEX "match_players_unique_team_side" ON "public"."match_players" USING "btree" ("match_id", "team", "court_side") WHERE ("court_side" IS NOT NULL);



CREATE INDEX "match_proposal_members_user" ON "public"."match_proposal_members" USING "btree" ("user_id");



CREATE INDEX "match_proposals_pending" ON "public"."match_proposals" USING "btree" ("status", "expires_at");



CREATE INDEX "play_intents_open_lookup" ON "public"."play_intents" USING "btree" ("play_date", "status");



CREATE UNIQUE INDEX "play_intents_user_slot_uniq" ON "public"."play_intents" USING "btree" ("user_id", "play_date", "start_time", "end_time") WHERE ("status" = ANY (ARRAY['open'::"text", 'proposed'::"text"]));



CREATE UNIQUE INDEX "uq_americano_matches_round_court" ON "public"."americano_matches" USING "btree" ("tournament_id", "round_number", COALESCE("court_index", 0));



CREATE UNIQUE INDEX "uq_match_results_match_id" ON "public"."match_results" USING "btree" ("match_id");



CREATE OR REPLACE TRIGGER "americano_elo_history_sync_profile" AFTER INSERT OR DELETE OR UPDATE ON "public"."americano_elo_history" FOR EACH ROW EXECUTE FUNCTION "public"."trg_americano_elo_history_sync_profile"();



CREATE OR REPLACE TRIGGER "elo_history_sync_profile" AFTER INSERT OR DELETE OR UPDATE ON "public"."elo_history" FOR EACH ROW EXECUTE FUNCTION "public"."trg_elo_history_sync_profile"();



CREATE OR REPLACE TRIGGER "match_players_fill_court_side" BEFORE INSERT OR UPDATE OF "team", "court_side", "user_id" ON "public"."match_players" FOR EACH ROW EXECUTE FUNCTION "public"."match_players_fill_court_side"();



CREATE OR REPLACE TRIGGER "notifications_dispatch_match_proposal" AFTER INSERT ON "public"."notifications" FOR EACH ROW WHEN (("new"."type" = 'match_proposal'::"text")) EXECUTE FUNCTION "public"."notifications_dispatch_match_proposal"();



CREATE OR REPLACE TRIGGER "protect_elo_fields" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_elo_fields"();



CREATE OR REPLACE TRIGGER "trg_americano_matches_recalc_del" AFTER DELETE ON "public"."americano_matches" REFERENCING OLD TABLE AS "changed_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_americano_match_recalc_stats"();



CREATE OR REPLACE TRIGGER "trg_americano_matches_recalc_ins" AFTER INSERT ON "public"."americano_matches" REFERENCING NEW TABLE AS "changed_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_americano_match_recalc_stats"();



CREATE OR REPLACE TRIGGER "trg_americano_matches_recalc_upd" AFTER UPDATE ON "public"."americano_matches" REFERENCING NEW TABLE AS "changed_rows" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_americano_match_recalc_stats"();



CREATE OR REPLACE TRIGGER "trg_archive_profile_before_delete" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."archive_profile_before_delete"();



CREATE OR REPLACE TRIGGER "trg_elo_history_auto_flag_match" AFTER INSERT ON "public"."elo_history" FOR EACH ROW EXECUTE FUNCTION "public"."trg_elo_history_auto_flag_match"();



CREATE OR REPLACE TRIGGER "trg_enforce_max_players" BEFORE INSERT ON "public"."match_players" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_max_players"();



CREATE OR REPLACE TRIGGER "trg_guard_americano_complete_transition" BEFORE UPDATE OF "status" ON "public"."americano_tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."guard_americano_complete_transition"();



CREATE OR REPLACE TRIGGER "trg_guard_americano_participant_insert" BEFORE INSERT ON "public"."americano_participants" FOR EACH ROW EXECUTE FUNCTION "public"."guard_americano_participant_insert"();



CREATE OR REPLACE TRIGGER "trg_guard_match_result_confirmation" BEFORE UPDATE ON "public"."match_results" FOR EACH ROW EXECUTE FUNCTION "public"."guard_match_result_confirmation"();



CREATE OR REPLACE TRIGGER "trg_guard_matches_client_update" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."guard_matches_client_update"();



CREATE OR REPLACE TRIGGER "trg_league_team_messages_set_league_id" BEFORE INSERT ON "public"."league_team_messages" FOR EACH ROW EXECUTE FUNCTION "public"."league_team_messages_set_league_id"();



CREATE OR REPLACE TRIGGER "trg_messages_enforce_dm_block" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."messages_enforce_dm_block"();



CREATE OR REPLACE TRIGGER "trg_protect_elo_fields" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_elo_fields"();



CREATE OR REPLACE TRIGGER "trg_set_americano_elo_history_engine_meta" BEFORE INSERT ON "public"."americano_elo_history" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_americano_elo_history_engine_meta"();



CREATE OR REPLACE TRIGGER "trg_set_elo_history_engine_meta" BEFORE INSERT ON "public"."elo_history" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_elo_history_engine_meta"();



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_pin_sessions"
    ADD CONSTRAINT "admin_pin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_pin_settings"
    ADD CONSTRAINT "admin_pin_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_elo_history"
    ADD CONSTRAINT "americano_elo_history_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."americano_tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_elo_history"
    ADD CONSTRAINT "americano_elo_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_matches"
    ADD CONSTRAINT "americano_matches_team_a_p1_fkey" FOREIGN KEY ("team_a_p1") REFERENCES "public"."americano_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_matches"
    ADD CONSTRAINT "americano_matches_team_a_p2_fkey" FOREIGN KEY ("team_a_p2") REFERENCES "public"."americano_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_matches"
    ADD CONSTRAINT "americano_matches_team_b_p1_fkey" FOREIGN KEY ("team_b_p1") REFERENCES "public"."americano_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_matches"
    ADD CONSTRAINT "americano_matches_team_b_p2_fkey" FOREIGN KEY ("team_b_p2") REFERENCES "public"."americano_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_matches"
    ADD CONSTRAINT "americano_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."americano_tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_participants"
    ADD CONSTRAINT "americano_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."americano_tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_participants"
    ADD CONSTRAINT "americano_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."americano_tournaments"
    ADD CONSTRAINT "americano_tournaments_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."americano_tournaments"
    ADD CONSTRAINT "americano_tournaments_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."court_slots"
    ADD CONSTRAINT "court_slots_booked_by_fkey" FOREIGN KEY ("booked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."court_slots"
    ADD CONSTRAINT "court_slots_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deleted_players_archive"
    ADD CONSTRAINT "deleted_players_archive_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deleted_players_archive"
    ADD CONSTRAINT "deleted_players_archive_restored_by_fkey" FOREIGN KEY ("restored_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deleted_players_archive"
    ADD CONSTRAINT "deleted_players_archive_restored_user_id_fkey" FOREIGN KEY ("restored_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."elo_history"
    ADD CONSTRAINT "elo_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."elo_history"
    ADD CONSTRAINT "elo_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."glicko2_shadow_history"
    ADD CONSTRAINT "glicko2_shadow_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."glicko2_shadow_history"
    ADD CONSTRAINT "glicko2_shadow_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."glicko2_shadow_ratings"
    ADD CONSTRAINT "glicko2_shadow_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."growth_campaign_entries"
    ADD CONSTRAINT "growth_campaign_entries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."growth_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."growth_campaign_entries"
    ADD CONSTRAINT "growth_campaign_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."growth_campaigns"
    ADD CONSTRAINT "growth_campaigns_drawn_by_fkey" FOREIGN KEY ("drawn_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."growth_campaigns"
    ADD CONSTRAINT "growth_campaigns_winner_user_id_fkey" FOREIGN KEY ("winner_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."league_matches"
    ADD CONSTRAINT "league_matches_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_matches"
    ADD CONSTRAINT "league_matches_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."league_matches"
    ADD CONSTRAINT "league_matches_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "public"."league_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_matches"
    ADD CONSTRAINT "league_matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "public"."league_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_matches"
    ADD CONSTRAINT "league_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "public"."league_teams"("id");



ALTER TABLE ONLY "public"."league_team_messages"
    ADD CONSTRAINT "league_team_messages_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_team_messages"
    ADD CONSTRAINT "league_team_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_team_messages"
    ADD CONSTRAINT "league_team_messages_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."league_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_join_requests"
    ADD CONSTRAINT "match_join_requests_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_join_requests"
    ADD CONSTRAINT "match_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_messages"
    ADD CONSTRAINT "match_messages_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_messages"
    ADD CONSTRAINT "match_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_photos"
    ADD CONSTRAINT "match_photos_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_photos"
    ADD CONSTRAINT "match_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_proposal_members"
    ADD CONSTRAINT "match_proposal_members_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "public"."play_intents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_proposal_members"
    ADD CONSTRAINT "match_proposal_members_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."match_proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_proposal_members"
    ADD CONSTRAINT "match_proposal_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_proposals"
    ADD CONSTRAINT "match_proposals_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_team1_player1_id_fkey" FOREIGN KEY ("team1_player1_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_team1_player2_id_fkey" FOREIGN KEY ("team1_player2_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_team2_player1_id_fkey" FOREIGN KEY ("team2_player1_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."match_results"
    ADD CONSTRAINT "match_results_team2_player2_id_fkey" FOREIGN KEY ("team2_player2_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."play_intents"
    ADD CONSTRAINT "play_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rating_admin_flags"
    ADD CONSTRAINT "rating_admin_flags_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rating_admin_flags"
    ADD CONSTRAINT "rating_admin_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rating_admin_flags"
    ADD CONSTRAINT "rating_admin_flags_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."americano_tournaments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reactivation_log"
    ADD CONSTRAINT "reactivation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."result_error_reports"
    ADD CONSTRAINT "result_error_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."result_error_reports"
    ADD CONSTRAINT "result_error_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_favorite_id_fkey" FOREIGN KEY ("favorite_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_favorites"
    ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Alle kan se baner" ON "public"."courts" FOR SELECT USING (true);



CREATE POLICY "Alle kan se kampe" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Alle kan se resultater" ON "public"."match_results" FOR SELECT USING (true);



CREATE POLICY "Alle kan se tider" ON "public"."court_slots" FOR SELECT USING (true);



CREATE POLICY "Autentificerede kan oprette kampe" ON "public"."matches" FOR INSERT TO "authenticated" WITH CHECK ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) AND (NOT "public"."is_banned"())));



CREATE POLICY "Authenticated can send" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK (("sender_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Brugere kan opdatere eigen profil" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR "public"."is_admin"())) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "id") OR "public"."is_admin"()));



CREATE POLICY "Brugere kan oprette egne bookinger" ON "public"."bookings" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Brugere kan oprette eigen profil" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "id") OR "public"."is_admin"()));



CREATE POLICY "Brugere kan se egne bookinger" ON "public"."bookings" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Brugere kan slette egne bookinger" ON "public"."bookings" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Can cancel own booking" ON "public"."bookings" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Deltagere kan afvise ubekraeftede resultater" ON "public"."match_results" FOR DELETE TO "authenticated" USING (("public"."is_admin"() OR ("submitted_by" = ( SELECT "auth"."uid"() AS "uid")) OR (("confirmed" IS NOT TRUE) AND (EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "match_results"."match_id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Deltagere kan indsende resultater" ON "public"."match_results" FOR INSERT TO "authenticated" WITH CHECK (((("submitted_by" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "match_results"."match_id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR "public"."is_admin"()));



CREATE POLICY "Ingen kan slette profiler" ON "public"."profiles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Users mark received messages read" ON "public"."messages" FOR UPDATE TO "authenticated" USING ((("receiver_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"())) WITH CHECK ((("receiver_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "Users see own messages" ON "public"."messages" FOR SELECT TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("receiver_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_pin_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_pin_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."americano_elo_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "americano_elo_history_delete_deny" ON "public"."americano_elo_history" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "americano_elo_history_insert_deny" ON "public"."americano_elo_history" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "americano_elo_history_select_authenticated" ON "public"."americano_elo_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "americano_elo_history_update_deny" ON "public"."americano_elo_history" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."americano_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "americano_matches_delete_creator" ON "public"."americano_matches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."americano_tournaments" "t"
  WHERE (("t"."id" = "americano_matches"."tournament_id") AND ("t"."creator_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "americano_matches_insert_creator" ON "public"."americano_matches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."americano_tournaments" "t"
  WHERE (("t"."id" = "americano_matches"."tournament_id") AND ("t"."creator_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



CREATE POLICY "americano_matches_select" ON "public"."americano_matches" FOR SELECT TO "authenticated" USING ((("public"."americano_internal_tournament_status"("tournament_id") = 'completed'::"text") OR ("public"."americano_internal_tournament_creator"("tournament_id") = ( SELECT "auth"."uid"() AS "uid")) OR "public"."americano_is_participant"("tournament_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "americano_matches_update_creator" ON "public"."americano_matches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."americano_tournaments" "t"
  WHERE (("t"."id" = "americano_matches"."tournament_id") AND ("t"."creator_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."americano_tournaments" "t"
  WHERE (("t"."id" = "americano_matches"."tournament_id") AND ("t"."creator_id" = ( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid"))))));



ALTER TABLE "public"."americano_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "americano_participants_delete" ON "public"."americano_participants" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."americano_tournaments" "t"
  WHERE (("t"."id" = "americano_participants"."tournament_id") AND ("t"."status" = 'registration'::"text")))) AND (("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."americano_tournaments" "t"
  WHERE (("t"."id" = "americano_participants"."tournament_id") AND ("t"."creator_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "americano_participants_insert" ON "public"."americano_participants" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "user_id"));



CREATE POLICY "americano_participants_select" ON "public"."americano_participants" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."americano_internal_tournament_status"("tournament_id") = ANY (ARRAY['registration'::"text", 'completed'::"text"])) OR ("public"."americano_internal_tournament_creator"("tournament_id") = ( SELECT "auth"."uid"() AS "uid")) OR "public"."americano_is_participant"("tournament_id", ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."americano_tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "americano_tournaments_delete" ON "public"."americano_tournaments" FOR DELETE TO "authenticated" USING ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "creator_id"));



CREATE POLICY "americano_tournaments_insert" ON "public"."americano_tournaments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "creator_id"));



CREATE POLICY "americano_tournaments_select" ON "public"."americano_tournaments" FOR SELECT TO "authenticated" USING ((("status" = ANY (ARRAY['registration'::"text", 'completed'::"text"])) OR ("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."americano_is_participant"("id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "americano_tournaments_update" ON "public"."americano_tournaments" FOR UPDATE TO "authenticated" USING ((( SELECT ( SELECT "auth"."uid"() AS "uid") AS "uid") = "creator_id"));



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_slots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "courts_no_delete" ON "public"."courts" FOR DELETE USING (false);



CREATE POLICY "courts_no_insert" ON "public"."courts" FOR INSERT WITH CHECK (false);



CREATE POLICY "courts_no_update" ON "public"."courts" FOR UPDATE USING (false);



ALTER TABLE "public"."deleted_players_archive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deleted_players_archive_admin_select" ON "public"."deleted_players_archive" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "deleted_players_archive_admin_update" ON "public"."deleted_players_archive" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."elo_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "elo_history_admin_delete" ON "public"."elo_history" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "elo_history_admin_insert" ON "public"."elo_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "elo_history_admin_update" ON "public"."elo_history" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "elo_history_select_authenticated" ON "public"."elo_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."glicko2_shadow_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "glicko2_shadow_history_delete_deny" ON "public"."glicko2_shadow_history" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "glicko2_shadow_history_insert_deny" ON "public"."glicko2_shadow_history" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "glicko2_shadow_history_select_auth" ON "public"."glicko2_shadow_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "glicko2_shadow_history_update_deny" ON "public"."glicko2_shadow_history" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."glicko2_shadow_ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "glicko2_shadow_ratings_delete_deny" ON "public"."glicko2_shadow_ratings" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "glicko2_shadow_ratings_insert_deny" ON "public"."glicko2_shadow_ratings" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "glicko2_shadow_ratings_select_auth" ON "public"."glicko2_shadow_ratings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "glicko2_shadow_ratings_update_deny" ON "public"."glicko2_shadow_ratings" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."growth_campaign_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "growth_campaign_entries_admin_all" ON "public"."growth_campaign_entries" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "growth_campaign_entries_own_read" ON "public"."growth_campaign_entries" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."growth_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "growth_campaigns_public_read" ON "public"."growth_campaigns" FOR SELECT TO "authenticated", "anon" USING (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'drawn'::"text"])));



CREATE POLICY "join_req_admin" ON "public"."match_join_requests" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "join_req_delete_own" ON "public"."match_join_requests" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "join_req_insert" ON "public"."match_join_requests" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "join_req_select" ON "public"."match_join_requests" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_join_requests"."match_id") AND ("m"."creator_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "join_req_update_creator" ON "public"."match_join_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_join_requests"."match_id") AND ("matches"."creator_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."league_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "league_matches_delete" ON "public"."league_matches" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "league_matches_insert" ON "public"."league_matches" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."leagues" "l"
  WHERE (("l"."id" = "league_matches"."league_id") AND ("l"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "league_matches_select" ON "public"."league_matches" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "league_matches_update" ON "public"."league_matches" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."leagues" "l"
  WHERE (("l"."id" = "league_matches"."league_id") AND ("l"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."league_teams" "t"
  WHERE (("t"."id" = ANY (ARRAY["league_matches"."team1_id", "league_matches"."team2_id"])) AND (("t"."player1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("t"."player2_id" = ( SELECT "auth"."uid"() AS "uid")))))))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."leagues" "l"
  WHERE (("l"."id" = "league_matches"."league_id") AND ("l"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."league_teams" "t"
  WHERE (("t"."id" = ANY (ARRAY["league_matches"."team1_id", "league_matches"."team2_id"])) AND (("t"."player1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("t"."player2_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."league_team_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "league_team_messages_delete" ON "public"."league_team_messages" FOR DELETE TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR COALESCE("public"."is_admin"(), false)));



CREATE POLICY "league_team_messages_insert" ON "public"."league_team_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 1000)) AND "public"."is_league_participant"("league_id")));



CREATE POLICY "league_team_messages_select" ON "public"."league_team_messages" FOR SELECT TO "authenticated" USING ("public"."is_league_participant"("league_id"));



ALTER TABLE "public"."league_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "league_teams_delete" ON "public"."league_teams" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."leagues" "l"
  WHERE (("l"."id" = "league_teams"."league_id") AND ("lower"(COALESCE("l"."status", ''::"text")) = 'registration'::"text")))) AND (("player1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("player2_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."leagues" "l"
  WHERE (("l"."id" = "league_teams"."league_id") AND ("l"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "league_teams_insert" ON "public"."league_teams" FOR INSERT TO "authenticated" WITH CHECK ((("player1_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("player2_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "league_teams_select" ON "public"."league_teams" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "league_teams_update" ON "public"."league_teams" FOR UPDATE TO "authenticated" USING ((("player2_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_admin_role"() AS "has_admin_role")));



ALTER TABLE "public"."leagues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leagues_delete" ON "public"."leagues" FOR DELETE TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "leagues_insert" ON "public"."leagues" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_admin_role"() AS "has_admin_role")));



CREATE POLICY "leagues_select" ON "public"."leagues" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "leagues_update" ON "public"."leagues" FOR UPDATE TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_admin_role"() AS "has_admin_role"))) WITH CHECK ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_admin_role"() AS "has_admin_role")));



ALTER TABLE "public"."match_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_messages_delete_own_or_admin" ON "public"."match_messages" FOR DELETE TO "authenticated" USING ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "match_messages_insert_participants" ON "public"."match_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 1000)) AND (EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "match_messages"."match_id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "match_messages_select_participants" ON "public"."match_messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "match_messages"."match_id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin"()));



ALTER TABLE "public"."match_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_photos_delete_own" ON "public"."match_photos" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "match_photos_insert_own" ON "public"."match_photos" FOR INSERT WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "match_photos"."match_id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "match_photos_select" ON "public"."match_photos" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "match_photos"."match_id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR (EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_photos"."match_id") AND ("m"."creator_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin"()));



ALTER TABLE "public"."match_players" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_players_delete_self_or_creator" ON "public"."match_players" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_players"."match_id") AND ("m"."creator_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin"()));



CREATE POLICY "match_players_insert_via_rpc_only" ON "public"."match_players" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "match_players_select_authenticated" ON "public"."match_players" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "match_players_update_via_rpc_only" ON "public"."match_players" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



COMMENT ON POLICY "match_players_update_via_rpc_only" ON "public"."match_players" IS 'Hold og banehalvdel ændres kun via set_match_player_team / set_match_player_court_side (SECURITY DEFINER), som håndhæver kampstatus og ejerskab.';



ALTER TABLE "public"."match_proposal_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_proposal_members_select_member" ON "public"."match_proposal_members" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."match_proposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_proposals_select_member" ON "public"."match_proposals" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."match_proposal_members" "m"
  WHERE (("m"."proposal_id" = "match_proposals"."id") AND ("m"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."match_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "match_results_update_by_participant" ON "public"."match_results" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR (("confirmed" IS NOT TRUE) AND "public"."can_confirm_match_result"("match_id", "submitted_by", ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("public"."is_admin"() OR (("confirmed" IS TRUE) AND ("confirmed_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."can_confirm_match_result"("match_id", "submitted_by", ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_delete_by_creator_or_admin" ON "public"."matches" FOR DELETE TO "authenticated" USING ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "matches_update_by_creator_or_participant" ON "public"."matches" FOR UPDATE TO "authenticated" USING ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "matches"."id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin"())) WITH CHECK ((("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."match_players" "mp"
  WHERE (("mp"."match_id" = "matches"."id") AND ("mp"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."is_admin"()));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own_or_admin" ON "public"."notifications" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR "public"."is_admin"()));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."play_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "play_intents_select_own" ON "public"."play_intents" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_all_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions: bruger kan styre egne" ON "public"."push_subscriptions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."rate_limit_hits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_admin_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rating_admin_flags_delete_deny" ON "public"."rating_admin_flags" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "rating_admin_flags_insert_deny" ON "public"."rating_admin_flags" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "rating_admin_flags_select_admin" ON "public"."rating_admin_flags" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("lower"(COALESCE("p"."role", ''::"text")) = 'admin'::"text")))));



CREATE POLICY "rating_admin_flags_update_admin" ON "public"."rating_admin_flags" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("lower"(COALESCE("p"."role", ''::"text")) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("lower"(COALESCE("p"."role", ''::"text")) = 'admin'::"text")))));



ALTER TABLE "public"."reactivation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminder_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."result_error_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "result_error_reports_admin_all" ON "public"."result_error_reports" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "result_error_reports_select_own" ON "public"."result_error_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_blocks_delete_own" ON "public"."user_blocks" FOR DELETE TO "authenticated" USING (("blocker_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_blocks_insert_own" ON "public"."user_blocks" FOR INSERT TO "authenticated" WITH CHECK ((("blocker_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("blocked_id" <> ( SELECT "auth"."uid"() AS "uid")) AND (NOT "public"."is_banned"())));



CREATE POLICY "user_blocks_select_own" ON "public"."user_blocks" FOR SELECT TO "authenticated" USING ((("blocker_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("blocked_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."user_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_favorites_delete_own" ON "public"."user_favorites" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "user_favorites_insert_own" ON "public"."user_favorites" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("favorite_id" <> ( SELECT "auth"."uid"() AS "uid")) AND (NOT "public"."is_banned"())));



CREATE POLICY "user_favorites_select_own" ON "public"."user_favorites" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_reports_admin_all" ON "public"."user_reports" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "user_reports_insert_own" ON "public"."user_reports" FOR INSERT TO "authenticated" WITH CHECK ((("reporter_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("reported_id" <> ( SELECT "auth"."uid"() AS "uid")) AND (NOT "public"."is_banned"())));



CREATE POLICY "user_reports_select_own" ON "public"."user_reports" FOR SELECT TO "authenticated" USING (("reporter_id" = ( SELECT "auth"."uid"() AS "uid")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."americano_tournaments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."league_team_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."leagues";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."match_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."match_results";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."matches";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































REVOKE ALL ON FUNCTION "public"."_admin_audit_log"("p_action" "text", "p_target_user_id" "uuid", "p_details" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_admin_audit_log"("p_action" "text", "p_target_user_id" "uuid", "p_details" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_americano_entity_finished_at"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_americano_entity_finished_at"("p_tournament_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_insert_system_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_insert_system_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_league_entity_finished_at"("p_league_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_league_entity_finished_at"("p_league_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_result_error_entity_completed_at"("p_source_type" "text", "p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_result_error_entity_completed_at"("p_source_type" "text", "p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_result_error_entity_completed_at"("p_source_type" "text", "p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_rpc_rate_limit_or_raise"("p_bucket" "text", "p_max" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_rpc_rate_limit_or_raise"("p_bucket" "text", "p_max" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_skip_duplicate_entity_notification"("p_user_id" "uuid", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_skip_duplicate_entity_notification"("p_user_id" "uuid", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_skip_duplicate_match_notification"("p_user_id" "uuid", "p_type" "text", "p_match_id" "uuid", "p_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_skip_duplicate_match_notification"("p_user_id" "uuid", "p_type" "text", "p_match_id" "uuid", "p_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_adjust_americano_elo"("p_user_id" "uuid", "p_new_elo" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_adjust_americano_elo"("p_user_id" "uuid", "p_new_elo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_adjust_americano_elo"("p_user_id" "uuid", "p_new_elo" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_adjust_elo"("p_user_id" "uuid", "p_new_elo" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_adjust_elo"("p_user_id" "uuid", "p_new_elo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_adjust_elo"("p_user_id" "uuid", "p_new_elo" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_audit_log_recent"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_audit_log_recent"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_audit_log_recent"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_clear_pin_session"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_clear_pin_session"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_clear_pin_session"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_correct_americano_tournament"("p_tournament_id" "uuid", "p_matches" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_correct_americano_tournament"("p_tournament_id" "uuid", "p_matches" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_correct_americano_tournament"("p_tournament_id" "uuid", "p_matches" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_correct_league_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_score_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_correct_league_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_score_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_correct_league_match"("p_match_id" "uuid", "p_winner_id" "uuid", "p_score_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_correct_match_result_and_recalc_elo"("p_match_result_id" "uuid", "p_result" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_correct_match_result_and_recalc_elo"("p_match_result_id" "uuid", "p_result" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_correct_match_result_and_recalc_elo"("p_match_result_id" "uuid", "p_result" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_delete_match"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_match"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_match"("p_match_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_user_id" "uuid", "p_pin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_draw_growth_campaign"("p_slug" "text", "p_allow_partial" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_draw_growth_campaign"("p_slug" "text", "p_allow_partial" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_draw_growth_campaign"("p_slug" "text", "p_allow_partial" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_draw_growth_campaign"("p_slug" "text", "p_allow_partial" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_dm_messages_between"("p_user_a" "uuid", "p_user_b" "uuid", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_dm_messages_between"("p_user_a" "uuid", "p_user_b" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_dm_messages_between"("p_user_a" "uuid", "p_user_b" "uuid", "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_growth_campaign_draw_status"("p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_growth_campaign_draw_status"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_growth_campaign_draw_status"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_growth_campaign_draw_status"("p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_admin_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_admin_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_admin_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_growth_campaign_entries"("p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_growth_campaign_entries"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_list_growth_campaign_entries"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_growth_campaign_entries"("p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_open_result_error_reports_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_open_result_error_reports_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_open_result_error_reports_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_open_user_reports_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_open_user_reports_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_open_user_reports_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_pin_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_pin_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_pin_status"() TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("level") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("play_style") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("area") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("availability") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("bio") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar_emoji") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("elo_rating") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("games_played") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("games_won") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("games_lost") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("best_streak") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("current_streak") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("avatar") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("birth_year") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("americano_wins") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("americano_losses") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("americano_draws") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("court_side") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("americano_played") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("is_banned") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("ban_reason") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("latitude") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("longitude") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("travel_willing") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("intent_now") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("seeking_match") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("last_active_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("city") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("available_days") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("seeking_match_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("americano_elo_rating") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("preferred_partner_level") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("phone_verification_exempt") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("notification_prefs") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("match_watch_enabled") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("match_watch_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("makker_search_prefs") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("makker_watch_enabled") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("makker_watch_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("match_search_prefs") ON TABLE "public"."profiles" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_profiles_with_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_profiles_with_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_profiles_with_email"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_restore_deleted_profile"("p_archive_id" "uuid", "p_target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_restore_deleted_profile"("p_archive_id" "uuid", "p_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_restore_deleted_profile"("p_archive_id" "uuid", "p_target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_phone_verification_exempt"("p_user_id" "uuid", "p_exempt" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_phone_verification_exempt"("p_user_id" "uuid", "p_exempt" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_phone_verification_exempt"("p_user_id" "uuid", "p_exempt" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_setup_pin"("p_pin" "text", "p_remember_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_setup_pin"("p_pin" "text", "p_remember_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_setup_pin"("p_pin" "text", "p_remember_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_verify_pin"("p_pin" "text", "p_remember_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_verify_pin"("p_pin" "text", "p_remember_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_verify_pin"("p_pin" "text", "p_remember_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."americano_internal_tournament_creator"("p_tid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."americano_internal_tournament_creator"("p_tid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."americano_internal_tournament_creator"("p_tid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."americano_internal_tournament_creator"("p_tid" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."americano_internal_tournament_status"("p_tid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."americano_internal_tournament_status"("p_tid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."americano_internal_tournament_status"("p_tid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."americano_internal_tournament_status"("p_tid" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."americano_is_participant"("p_tid" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."americano_is_participant"("p_tid" "uuid", "p_uid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."americano_is_participant"("p_tid" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."americano_is_participant"("p_tid" "uuid", "p_uid" "uuid") TO "anon";



GRANT ALL ON FUNCTION "public"."americano_match_count_is_valid"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer, "p_actual_matches" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."americano_match_count_is_valid"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer, "p_actual_matches" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."americano_match_count_is_valid"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer, "p_actual_matches" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."americano_round_robin_base_rounds"("p_participants" integer, "p_courts_per_round" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."americano_round_robin_base_rounds"("p_participants" integer, "p_courts_per_round" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."americano_round_robin_base_rounds"("p_participants" integer, "p_courts_per_round" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_americano_elo_for_tournament"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_americano_elo_for_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_americano_elo_for_tournament"("p_tournament_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_elo_for_match"("p_match_result_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_elo_for_match"("p_match_result_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_elo_for_match"("p_match_result_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_elo_for_match_core"("p_match_result_id" "uuid", "p_actor_id" "uuid", "p_require_actor" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_elo_for_match_core"("p_match_result_id" "uuid", "p_actor_id" "uuid", "p_require_actor" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_elo_for_match_system"("p_match_result_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_elo_for_match_system"("p_match_result_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_glicko2_shadow_for_match"("p_match_result_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_glicko2_shadow_for_match"("p_match_result_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_match_join_request"("p_request_id" "uuid", "p_match_id" "uuid", "p_user_id" "uuid", "p_user_name" "text", "p_user_emoji" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_match_join_request"("p_request_id" "uuid", "p_match_id" "uuid", "p_user_id" "uuid", "p_user_name" "text", "p_user_emoji" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_match_join_request"("p_request_id" "uuid", "p_match_id" "uuid", "p_user_id" "uuid", "p_user_name" "text", "p_user_emoji" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_profile_before_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_profile_before_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."auto_confirm_expired_match_results"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auto_confirm_expired_match_results"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."block_user"("p_blocked_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."block_user"("p_blocked_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_user"("p_blocked_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_confirm_match_result"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_confirm_match_result"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_confirm_match_result"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_play_intent"("p_intent_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_play_intent"("p_intent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_play_intent"("p_intent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_play_intent"("p_intent_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."canonical_app_region"("p_area" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."canonical_app_region"("p_area" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."canonical_app_region"("p_area" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."canonical_app_region"("p_area" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_window_start" bigint, "p_max" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_key" "text", "p_window_start" bigint, "p_max" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_americano_tournament"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_americano_tournament"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_americano_tournament"("p_tournament_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_match_result_and_apply_elo"("p_match_result_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_match_result_and_apply_elo"("p_match_result_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_match_result_and_apply_elo"("p_match_result_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notification_for_user"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notification_for_user"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_for_user"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_notifications_for_users"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_notifications_for_users"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notifications_for_users"("p_user_ids" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_match_id" "uuid", "p_entity_type" "text", "p_entity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_play_intent"("p_play_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_play_intent"("p_play_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."create_play_intent"("p_play_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_play_intent"("p_play_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_rating_admin_flag"("p_source" "text", "p_reason" "text", "p_severity" "text", "p_match_id" "uuid", "p_tournament_id" "uuid", "p_payload" "jsonb", "p_notify_admins" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_rating_admin_flag"("p_source" "text", "p_reason" "text", "p_severity" "text", "p_match_id" "uuid", "p_tournament_id" "uuid", "p_payload" "jsonb", "p_notify_admins" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."detect_and_flag_suspicious_2v2_match"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detect_and_flag_suspicious_2v2_match"("p_match_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid", "p_types" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid", "p_types" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."discovery_notifications_today_count"("p_user_id" "uuid", "p_types" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."dispatch_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dispatch_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_type" "text", "p_entity_type" "text", "p_entity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dm_message_preview"("p_message_type" "text", "p_content" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."dm_message_preview"("p_message_type" "text", "p_content" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dm_message_preview"("p_message_type" "text", "p_content" "text", "p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."dm_users_blocked"("p_user_a" "uuid", "p_user_b" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dm_users_blocked"("p_user_a" "uuid", "p_user_b" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dm_users_blocked"("p_user_a" "uuid", "p_user_b" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_max_players"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_max_players"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enroll_growth_campaign"("p_slug" "text", "p_consent" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enroll_growth_campaign"("p_slug" "text", "p_consent" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."enroll_growth_campaign"("p_slug" "text", "p_consent" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enroll_growth_campaign"("p_slug" "text", "p_consent" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expected_americano_match_count"("p_participants" integer, "p_opponent_passes" integer, "p_courts_per_round" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."expected_americano_match_count_legacy"("p_participants" integer, "p_opponent_passes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."expected_americano_match_count_legacy"("p_participants" integer, "p_opponent_passes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."expected_americano_match_count_legacy"("p_participants" integer, "p_opponent_passes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_abandoned_in_progress_matches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_abandoned_in_progress_matches"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_stale_play_intents"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_stale_play_intents"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_unstarted_matches"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_unstarted_matches"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fetch_match_message_counts"("p_match_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fetch_match_message_counts"("p_match_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_match_message_counts"("p_match_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_match_message_counts"("p_match_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."format_padel_level"("p_level" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."format_padel_level"("p_level" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."format_padel_level"("p_level" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_padel_level"("p_level" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_due_reactivation_nudges"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_due_reactivation_nudges"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_due_reminders"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_due_reminders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_growth_campaign_public"("p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_growth_campaign_public"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_growth_campaign_public"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_growth_campaign_public"("p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_growth_campaign_status"("p_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_growth_campaign_status"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_growth_campaign_status"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_growth_campaign_status"("p_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."glicko2_shadow_update_one"("p_rating" numeric, "p_rd" numeric, "p_volatility" numeric, "p_opp_rating" numeric, "p_opp_rd" numeric, "p_outcome" numeric, "p_tau" numeric, "p_epsilon" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."glicko2_shadow_update_one"("p_rating" numeric, "p_rd" numeric, "p_volatility" numeric, "p_opp_rating" numeric, "p_opp_rd" numeric, "p_outcome" numeric, "p_tau" numeric, "p_epsilon" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."glicko2_shadow_update_one"("p_rating" numeric, "p_rd" numeric, "p_volatility" numeric, "p_opp_rating" numeric, "p_opp_rd" numeric, "p_outcome" numeric, "p_tau" numeric, "p_epsilon" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_americano_complete_transition"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_americano_complete_transition"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_americano_participant_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_americano_participant_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_match_result_confirmation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_match_result_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_match_result_confirmation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_matches_client_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_matches_client_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_admin_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_admin_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_valid_match_result_confirmation"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_valid_match_result_confirmation"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_valid_match_result_confirmation"("p_match_id" "uuid", "p_submitted_by" "uuid", "p_confirmed_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lon1" double precision, "lat2" double precision, "lon2" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_banned"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_banned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_banned"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_league_participant"("p_league_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_league_participant"("p_league_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_league_participant"("p_league_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_league_participant"("p_league_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_user_admin_verified"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_user_admin_verified"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_admin_verified"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."join_open_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text", "p_court_side" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."join_open_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text", "p_court_side" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_open_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text", "p_court_side" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_open_match"("p_match_id" "uuid", "p_team" integer, "p_user_name" "text", "p_user_email" "text", "p_user_emoji" "text", "p_court_side" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kampe_unread_badge_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kampe_unread_badge_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kampe_unread_badge_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."kick_player_from_match"("p_match_id" "uuid", "p_target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kick_player_from_match"("p_match_id" "uuid", "p_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kick_player_from_match"("p_match_id" "uuid", "p_target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."league_team_messages_set_league_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."league_team_messages_set_league_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_match"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_match"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_match"("p_match_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_dm_conversation_summaries"("p_scan_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_dm_conversation_summaries"("p_scan_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_dm_conversation_summaries"("p_scan_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_pending_match_proposals"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_pending_match_proposals"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_pending_match_proposals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_pending_match_proposals"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."makker_feed_is_active"("p_prefs" "jsonb", "p_seeking_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."makker_feed_is_active"("p_prefs" "jsonb", "p_seeking_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."makker_feed_is_active"("p_prefs" "jsonb", "p_seeking_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_feed_is_active"("p_prefs" "jsonb", "p_seeking_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_availability_overlap"("p_filter" "jsonb", "p_subject" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_availability_overlap"("p_filter" "jsonb", "p_subject" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_availability_overlap"("p_filter" "jsonb", "p_subject" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_court_side_ok"("p_mode" "text", "p_watcher_side" "text", "p_subject_side" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_court_side_ok"("p_mode" "text", "p_watcher_side" "text", "p_subject_side" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_court_side_ok"("p_mode" "text", "p_watcher_side" "text", "p_subject_side" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_intent_compat_score"("p_a" "text", "p_b" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_intent_compat_score"("p_a" "text", "p_b" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_intent_compat_score"("p_a" "text", "p_b" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_intent_ok"("p_intents" "jsonb", "p_mode" "text", "p_subject_intent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_intent_ok"("p_intents" "jsonb", "p_mode" "text", "p_subject_intent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_intent_ok"("p_intents" "jsonb", "p_mode" "text", "p_subject_intent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_level_bounds"("p_prefs" "jsonb", "p_watcher_level" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_level_bounds"("p_prefs" "jsonb", "p_watcher_level" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_level_bounds"("p_prefs" "jsonb", "p_watcher_level" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_normalize_intent"("p_intent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_normalize_intent"("p_intent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_normalize_intent"("p_intent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_normalize_side"("p_side" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_normalize_side"("p_side" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_normalize_side"("p_side" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_partner_court_side_ok"("p_prefs" "jsonb", "p_watcher_court_side" "text", "p_subject_court_side" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_partner_court_side_ok"("p_prefs" "jsonb", "p_watcher_court_side" "text", "p_subject_court_side" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_partner_court_side_ok"("p_prefs" "jsonb", "p_watcher_court_side" "text", "p_subject_court_side" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_play_style_ok"("p_filter_style" "text", "p_subject_style" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_play_style_ok"("p_filter_style" "text", "p_subject_style" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_play_style_ok"("p_filter_style" "text", "p_subject_style" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."makker_filter_resolve_partner_court_side"("p_prefs" "jsonb", "p_watcher_court_side" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."makker_filter_resolve_partner_court_side"("p_prefs" "jsonb", "p_watcher_court_side" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."makker_filter_resolve_partner_court_side"("p_prefs" "jsonb", "p_watcher_court_side" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_filter_level_window_from_prefs"("p_prefs" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."match_filter_level_window_from_prefs"("p_prefs" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_filter_level_window_from_prefs"("p_prefs" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_filter_prefs_level"("p_prefs" "jsonb", "p_profile_level" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."match_filter_prefs_level"("p_prefs" "jsonb", "p_profile_level" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_filter_prefs_level"("p_prefs" "jsonb", "p_profile_level" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_players_fill_court_side"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_players_fill_court_side"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."match_players_free_court_side"("p_match_id" "uuid", "p_team" integer, "p_exclude_id" "uuid", "p_preferred" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."match_players_free_court_side"("p_match_id" "uuid", "p_team" integer, "p_exclude_id" "uuid", "p_preferred" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."match_players_free_court_side"("p_match_id" "uuid", "p_team" integer, "p_exclude_id" "uuid", "p_preferred" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_players_free_court_side"("p_match_id" "uuid", "p_team" integer, "p_exclude_id" "uuid", "p_preferred" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."messages_enforce_dm_block"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."messages_enforce_dm_block"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notifications_dispatch_match_proposal"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notifications_dispatch_match_proposal"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_auto_confirmed_match_result"("p_match_id" "uuid", "p_score_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_auto_confirmed_match_result"("p_match_id" "uuid", "p_score_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_creator_join_request"("p_match_id" "uuid", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_creator_join_request"("p_match_id" "uuid", "p_title" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_creator_join_request"("p_match_id" "uuid", "p_title" "text", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_elo_changes_for_match"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_elo_changes_for_match"("p_match_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_league_invite"("p_user_id" "uuid", "p_league_id" "uuid", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_league_invite"("p_user_id" "uuid", "p_league_id" "uuid", "p_title" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_league_invite"("p_user_id" "uuid", "p_league_id" "uuid", "p_title" "text", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_league_invite_accepted"("p_team_id" "uuid", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_league_invite_accepted"("p_team_id" "uuid", "p_title" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_league_invite_accepted"("p_team_id" "uuid", "p_title" "text", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_league_invite_declined"("p_team_id" "uuid", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_league_invite_declined"("p_team_id" "uuid", "p_title" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_league_invite_declined"("p_team_id" "uuid", "p_title" "text", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_makker_watchers"("p_subject_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_makker_watchers"("p_subject_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_makker_watchers"("p_subject_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_match_creator_on_join"("p_match_id" "uuid", "p_title" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_match_creator_on_join"("p_match_id" "uuid", "p_title" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_match_creator_on_join"("p_match_id" "uuid", "p_title" "text", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_match_watchers"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_match_watchers"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_match_watchers"("p_match_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."padel_elo_to_level"("p_elo" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."padel_elo_to_level"("p_elo" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."padel_elo_to_level"("p_elo" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."padel_level_to_elo"("p_level" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."padel_level_to_elo"("p_level" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."padel_level_to_elo"("p_level" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."parse_clock_time"("p_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."parse_clock_time"("p_value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_clock_time"("p_value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_clock_time"("p_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."play_intent_overlaps_match_time"("p_intent_start" time without time zone, "p_intent_end" time without time zone, "p_match_time" "text", "p_match_time_end" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."play_intent_overlaps_match_time"("p_intent_start" time without time zone, "p_intent_end" time without time zone, "p_match_time" "text", "p_match_time_end" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."play_intent_overlaps_match_time"("p_intent_start" time without time zone, "p_intent_end" time without time zone, "p_match_time" "text", "p_match_time_end" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."play_intent_overlaps_match_time"("p_intent_start" time without time zone, "p_intent_end" time without time zone, "p_match_time" "text", "p_match_time_end" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_elo_fields"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_elo_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_elo_fields"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_americano_preview"("p_tournament_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_americano_preview"("p_tournament_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."public_americano_preview"("p_tournament_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_americano_preview"("p_tournament_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_match_preview"("p_match_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_match_preview"("p_match_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."public_match_preview"("p_match_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_match_preview"("p_match_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_platform_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_platform_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."public_platform_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_platform_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_upcoming_americano_events"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalc_americano_elo_from_history"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalc_americano_elo_from_history"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalc_americano_profile_stats"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalc_americano_profile_stats"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."recalc_profile_stats_from_elo_history"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recalc_profile_stats_from_elo_history"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_americano_match_score"("p_match_id" "uuid", "p_score_a" integer, "p_score_b" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_americano_match_score"("p_match_id" "uuid", "p_score_a" integer, "p_score_b" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_americano_match_score"("p_match_id" "uuid", "p_score_a" integer, "p_score_b" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_user"("p_reported_id" "uuid", "p_reason" "text", "p_details" "text", "p_context" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_user"("p_reported_id" "uuid", "p_reason" "text", "p_details" "text", "p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_user"("p_reported_id" "uuid", "p_reason" "text", "p_details" "text", "p_context" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."respond_to_match_proposal"("p_proposal_id" "uuid", "p_accept" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respond_to_match_proposal"("p_proposal_id" "uuid", "p_accept" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."respond_to_match_proposal"("p_proposal_id" "uuid", "p_accept" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."respond_to_match_proposal"("p_proposal_id" "uuid", "p_accept" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_dm_message_reaction"("p_message_id" "uuid", "p_reaction" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_dm_message_reaction"("p_message_id" "uuid", "p_reaction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_dm_message_reaction"("p_message_id" "uuid", "p_reaction" "text") TO "service_role";



GRANT ALL ON TABLE "public"."league_team_messages" TO "anon";
GRANT ALL ON TABLE "public"."league_team_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."league_team_messages" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_league_team_message_reaction"("p_message_id" "uuid", "p_reaction" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_league_team_message_reaction"("p_message_id" "uuid", "p_reaction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_league_team_message_reaction"("p_message_id" "uuid", "p_reaction" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_match_player_court_side"("p_match_id" "uuid", "p_user_id" "uuid", "p_side" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_match_player_court_side"("p_match_id" "uuid", "p_user_id" "uuid", "p_side" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_match_player_court_side"("p_match_id" "uuid", "p_user_id" "uuid", "p_side" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_match_player_court_side"("p_match_id" "uuid", "p_user_id" "uuid", "p_side" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_match_player_team"("p_match_id" "uuid", "p_user_id" "uuid", "p_team" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_match_player_team"("p_match_id" "uuid", "p_user_id" "uuid", "p_team" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_match_player_team"("p_match_id" "uuid", "p_user_id" "uuid", "p_team" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_result_error_report"("p_source_type" "text", "p_entity_id" "uuid", "p_reason" "text", "p_details" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_result_error_report"("p_source_type" "text", "p_entity_id" "uuid", "p_reason" "text", "p_details" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_result_error_report"("p_source_type" "text", "p_entity_id" "uuid", "p_reason" "text", "p_details" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_americano_elo_history_sync_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_americano_elo_history_sync_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_americano_elo_history_sync_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_americano_match_recalc_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_americano_match_recalc_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_elo_history_auto_flag_match"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_elo_history_auto_flag_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_elo_history_sync_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_elo_history_sync_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_set_americano_elo_history_engine_meta"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_set_americano_elo_history_engine_meta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_set_elo_history_engine_meta"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_set_elo_history_engine_meta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."try_form_match_proposal"("p_seed_intent_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_form_match_proposal"("p_seed_intent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."try_form_match_proposal"("p_seed_intent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."try_form_match_proposal"("p_seed_intent_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unblock_user"("p_blocked_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_is_phone_verification_exempt"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_is_phone_verification_exempt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_phone_verification_exempt"() TO "service_role";
























GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_pin_sessions" TO "anon";
GRANT ALL ON TABLE "public"."admin_pin_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_pin_settings" TO "anon";
GRANT ALL ON TABLE "public"."admin_pin_settings" TO "service_role";



GRANT ALL ON TABLE "public"."americano_elo_history" TO "anon";
GRANT ALL ON TABLE "public"."americano_elo_history" TO "authenticated";
GRANT ALL ON TABLE "public"."americano_elo_history" TO "service_role";



GRANT ALL ON TABLE "public"."americano_matches" TO "anon";
GRANT ALL ON TABLE "public"."americano_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."americano_matches" TO "service_role";



GRANT ALL ON TABLE "public"."americano_participants" TO "anon";
GRANT ALL ON TABLE "public"."americano_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."americano_participants" TO "service_role";



GRANT ALL ON TABLE "public"."americano_tournaments" TO "anon";
GRANT ALL ON TABLE "public"."americano_tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."americano_tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."court_slots" TO "anon";
GRANT ALL ON TABLE "public"."court_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."court_slots" TO "service_role";



GRANT ALL ON TABLE "public"."courts" TO "anon";
GRANT ALL ON TABLE "public"."courts" TO "authenticated";
GRANT ALL ON TABLE "public"."courts" TO "service_role";



GRANT ALL ON TABLE "public"."deleted_players_archive" TO "anon";
GRANT ALL ON TABLE "public"."deleted_players_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."deleted_players_archive" TO "service_role";



GRANT ALL ON TABLE "public"."elo_history" TO "anon";
GRANT ALL ON TABLE "public"."elo_history" TO "authenticated";
GRANT ALL ON TABLE "public"."elo_history" TO "service_role";



GRANT ALL ON TABLE "public"."glicko2_shadow_history" TO "anon";
GRANT ALL ON TABLE "public"."glicko2_shadow_history" TO "authenticated";
GRANT ALL ON TABLE "public"."glicko2_shadow_history" TO "service_role";



GRANT ALL ON TABLE "public"."glicko2_shadow_ratings" TO "anon";
GRANT ALL ON TABLE "public"."glicko2_shadow_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."glicko2_shadow_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."growth_campaign_entries" TO "anon";
GRANT ALL ON TABLE "public"."growth_campaign_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."growth_campaign_entries" TO "service_role";



GRANT ALL ON TABLE "public"."growth_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."growth_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."growth_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."league_matches" TO "anon";
GRANT ALL ON TABLE "public"."league_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."league_matches" TO "service_role";



GRANT ALL ON TABLE "public"."league_teams" TO "anon";
GRANT ALL ON TABLE "public"."league_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."league_teams" TO "service_role";



GRANT ALL ON TABLE "public"."leagues" TO "anon";
GRANT ALL ON TABLE "public"."leagues" TO "authenticated";
GRANT ALL ON TABLE "public"."leagues" TO "service_role";



GRANT ALL ON TABLE "public"."match_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."match_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."match_join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."match_messages" TO "anon";
GRANT ALL ON TABLE "public"."match_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."match_messages" TO "service_role";



GRANT ALL ON TABLE "public"."match_photos" TO "anon";
GRANT ALL ON TABLE "public"."match_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."match_photos" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."match_players" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."match_players" TO "authenticated";
GRANT ALL ON TABLE "public"."match_players" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("match_id") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("user_name") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("user_emoji") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("joined_at") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("team") ON TABLE "public"."match_players" TO "authenticated";



GRANT SELECT("court_side") ON TABLE "public"."match_players" TO "authenticated";



GRANT ALL ON TABLE "public"."match_proposal_members" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."match_proposal_members" TO "authenticated";
GRANT ALL ON TABLE "public"."match_proposal_members" TO "service_role";



GRANT ALL ON TABLE "public"."match_proposals" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."match_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."match_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."match_results" TO "anon";
GRANT ALL ON TABLE "public"."match_results" TO "authenticated";
GRANT ALL ON TABLE "public"."match_results" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."matches" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT UPDATE("current_players") ON TABLE "public"."matches" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."matches" TO "authenticated";



GRANT UPDATE("started_by") ON TABLE "public"."matches" TO "authenticated";



GRANT UPDATE("started_at") ON TABLE "public"."matches" TO "authenticated";



GRANT UPDATE("seeking_player") ON TABLE "public"."matches" TO "authenticated";



GRANT UPDATE("seeking_player_notified_at") ON TABLE "public"."matches" TO "authenticated";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."play_intents" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."play_intents" TO "authenticated";
GRANT ALL ON TABLE "public"."play_intents" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_hits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_hits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_hits" TO "service_role";



GRANT ALL ON TABLE "public"."rating_admin_flags" TO "anon";
GRANT ALL ON TABLE "public"."rating_admin_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_admin_flags" TO "service_role";



GRANT ALL ON TABLE "public"."reactivation_log" TO "anon";
GRANT ALL ON TABLE "public"."reactivation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."reactivation_log" TO "service_role";



GRANT ALL ON TABLE "public"."reminder_log" TO "anon";
GRANT ALL ON TABLE "public"."reminder_log" TO "authenticated";
GRANT ALL ON TABLE "public"."reminder_log" TO "service_role";



GRANT ALL ON TABLE "public"."result_error_reports" TO "anon";
GRANT ALL ON TABLE "public"."result_error_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."result_error_reports" TO "service_role";



GRANT ALL ON TABLE "public"."user_blocks" TO "anon";
GRANT ALL ON TABLE "public"."user_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."user_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_favorites" TO "anon";
GRANT ALL ON TABLE "public"."user_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."user_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."user_reports" TO "anon";
GRANT ALL ON TABLE "public"."user_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."user_reports" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































