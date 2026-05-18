-- =============================================================================
-- Security hardening phase 2
-- Kør i Supabase → SQL Editor (én gang efter tidligere migrationer).
--
-- 1) Udvid protect_elo_fields (Americano + flere felter)
-- 2) Genskab messages RLS (blev droppet i rls_performance_advisor_fixes)
-- 3) Tilbagekald farlige EXECUTE-grants + stram apply_elo_for_match_core
-- 4) seeking_player cooldown + rate limits på notifikationer/rapporter
-- 5) Hårdn approve_match_join_request + is_admin() / PIN på policies
-- =============================================================================

-- ─── Hjælpere ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_user_admin_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.is_user_admin_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_admin_verified(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._rpc_rate_limit_or_raise(
  p_bucket text,
  p_max integer DEFAULT 30,
  p_window_seconds integer DEFAULT 3600
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public._rpc_rate_limit_or_raise(text, integer, integer) FROM PUBLIC;

-- ─── 1) protect_elo_fields: Americano + ban-felter ───────────────────────────

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

-- ─── 2) messages RLS ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users see own messages" ON public.messages;
    CREATE POLICY "Users see own messages"
      ON public.messages
      FOR SELECT
      TO authenticated
      USING (
        sender_id = (SELECT auth.uid())
        OR receiver_id = (SELECT auth.uid())
        OR public.is_admin()
      );

    DROP POLICY IF EXISTS "Authenticated can send" ON public.messages;
    CREATE POLICY "Authenticated can send"
      ON public.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (sender_id = (SELECT auth.uid()));

    DROP POLICY IF EXISTS "Users mark received messages read" ON public.messages;
    CREATE POLICY "Users mark received messages read"
      ON public.messages
      FOR UPDATE
      TO authenticated
      USING (receiver_id = (SELECT auth.uid()) OR public.is_admin())
      WITH CHECK (receiver_id = (SELECT auth.uid()) OR public.is_admin());
  END IF;
END
$$;

-- ─── 3) Tilbagekald farlige grants ───────────────────────────────────────────

DO $$
DECLARE
  r record;
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
    RAISE NOTICE 'Revoked client execute on %', r.sig;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.admin_list_admin_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_admin_ids() FROM anon;

-- apply_elo_for_match_core: klienter skal kun bruge apply_elo_for_match (wrapper).
-- Genkør apply_elo_for_match_core fra elo_v2_glicko2_shadow.sql hvis I mangler auth-bind;
-- den fil er opdateret med p_actor_id = auth.uid() når require_actor er true.

-- ─── 3b) admin_list_admin_ids: kun PIN-verificerede admins ───────────────────

CREATE OR REPLACE FUNCTION public.admin_list_admin_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.admin_list_admin_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_admin_ids() TO authenticated;

-- ─── 4) Resultat-bekræftelse: admin = PIN-verificeret ────────────────────────

CREATE OR REPLACE FUNCTION public.has_valid_match_result_confirmation(
  p_match_id uuid,
  p_submitted_by uuid,
  p_confirmed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_user_admin_verified(p_confirmed_by) THEN
    RETURN true;
  END IF;

  RETURN public.can_confirm_match_result(p_match_id, p_submitted_by, p_confirmed_by);
END;
$$;

REVOKE ALL ON FUNCTION public.has_valid_match_result_confirmation(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_valid_match_result_confirmation(uuid, uuid, uuid) TO authenticated;

-- ─── 5) approve_match_join_request: valider pending-række ────────────────────

CREATE OR REPLACE FUNCTION public.approve_match_join_request(
  p_request_id UUID,
  p_match_id   UUID,
  p_user_id    UUID,
  p_user_name  TEXT,
  p_user_emoji TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_t1         INT;
  v_t2         INT;
  v_team_num   INT;
  v_new_count  INT;
  v_req_status text;
BEGIN
  SELECT creator_id INTO v_creator_id FROM public.matches WHERE id = p_match_id;
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;
  IF v_creator_id <> auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_creator');
  END IF;

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

  PERFORM public._rpc_rate_limit_or_raise('approve_join', 60, 3600);

  UPDATE public.match_join_requests
  SET status = 'approved'
  WHERE id = p_request_id
    AND match_id = p_match_id
    AND user_id = p_user_id
    AND lower(coalesce(status, '')) = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_pending');
  END IF;

  SELECT COUNT(*) INTO v_t1 FROM public.match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM public.match_players WHERE match_id = p_match_id AND team = 2;
  v_team_num := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;

  INSERT INTO public.match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (p_match_id, p_user_id, p_user_name, '', COALESCE(p_user_emoji, '🎾'), v_team_num)
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*) INTO v_new_count FROM public.match_players WHERE match_id = p_match_id;

  IF v_t1 + (CASE WHEN v_team_num = 1 THEN 1 ELSE 0 END) >= 2
     AND v_t2 + (CASE WHEN v_team_num = 2 THEN 1 ELSE 0 END) >= 2 THEN
    UPDATE public.matches
    SET status = 'full', current_players = v_new_count, seeking_player = false
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches SET current_players = v_new_count WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', v_team_num);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_match_join_request(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_match_join_request(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

-- ─── 6) Notifikationer: rate limit + seeking_player cooldown ─────────────────

CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_last_notified timestamptz;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_type = 'seeking_player' THEN
    PERFORM public._rpc_rate_limit_or_raise('seeking_player', 3, 3600);
    IF p_match_id IS NULL THEN
      RAISE EXCEPTION 'Manglende match_id';
    END IF;
    SELECT m.seeking_player_notified_at
    INTO v_last_notified
    FROM public.matches m
    WHERE m.id = p_match_id
    FOR UPDATE;
    IF v_last_notified IS NOT NULL AND v_last_notified > now() - interval '30 minutes' THEN
      RAISE EXCEPTION 'Vent 30 min. før du råber op igen';
    END IF;
  ELSE
    PERFORM public._rpc_rate_limit_or_raise('notification', 40, 3600);
  END IF;

  IF p_user_id = v_caller THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Manglende match_id for notifikation til anden bruger';
  END IF;

  IF p_type = 'seeking_player' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
    ) AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_match_id AND m.creator_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);

    UPDATE public.matches
    SET seeking_player_notified_at = now()
    WHERE id = p_match_id;
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

  IF EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND m.creator_id = v_caller
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notifications_for_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_uid uuid;
  v_inserted integer := 0;
  v_distinct uuid[];
  v_max_recipients integer := 50;
  v_last_notified timestamptz;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_type = 'seeking_player' THEN
    v_max_recipients := 10;
    PERFORM public._rpc_rate_limit_or_raise('seeking_player', 3, 3600);
    IF p_match_id IS NULL THEN
      RAISE EXCEPTION 'Manglende match_id';
    END IF;
    SELECT m.seeking_player_notified_at
    INTO v_last_notified
    FROM public.matches m
    WHERE m.id = p_match_id
    FOR UPDATE;
    IF v_last_notified IS NOT NULL AND v_last_notified > now() - interval '30 minutes' THEN
      RAISE EXCEPTION 'Vent 30 min. før du råber op igen';
    END IF;
  ELSE
    PERFORM public._rpc_rate_limit_or_raise('notification', 40, 3600);
  END IF;

  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN 0;
  END IF;

  SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[])
  INTO v_distinct
  FROM unnest(p_user_ids) AS x
  WHERE x IS NOT NULL;

  IF cardinality(v_distinct) > v_max_recipients THEN
    RAISE EXCEPTION 'For mange modtagere (max %)', v_max_recipients;
  END IF;

  FOREACH v_uid IN ARRAY v_distinct
  LOOP
    BEGIN
      IF v_uid = v_caller THEN
        INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
        VALUES (v_uid, p_type, p_title, p_body, p_match_id, false);
        v_inserted := v_inserted + 1;
        CONTINUE;
      END IF;

      IF p_match_id IS NULL THEN
        CONTINUE;
      END IF;

      IF p_type = 'seeking_player' THEN
        IF EXISTS (
          SELECT 1 FROM public.match_players mp
          WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
        ) OR EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = p_match_id AND m.creator_id = v_caller
        ) THEN
          INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
          VALUES (v_uid, p_type, p_title, p_body, p_match_id, false);
          v_inserted := v_inserted + 1;
        END IF;
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id = v_uid
      ) AND NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = p_match_id AND m.creator_id = v_uid
      ) THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
      ) OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = p_match_id AND m.creator_id = v_caller
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
        VALUES (v_uid, p_type, p_title, p_body, p_match_id, false);
        v_inserted := v_inserted + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;

  IF p_type = 'seeking_player' AND p_match_id IS NOT NULL AND v_inserted > 0 THEN
    UPDATE public.matches
    SET seeking_player_notified_at = now()
    WHERE id = p_match_id;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, uuid) TO authenticated;

-- ─── 7) report_user: rate limit, fjern admin_ids fra svar ────────────────────

CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_context text DEFAULT 'dm'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_details text;
  v_reporter_name text;
  v_reported_name text;
  v_reason_label text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  PERFORM public._rpc_rate_limit_or_raise('user_report', 10, 86400);

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

  SELECT coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(name), ''),
    'En spiller'
  )
  INTO v_reporter_name
  FROM public.profiles
  WHERE id = v_caller;

  SELECT coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(name), ''),
    'En spiller'
  )
  INTO v_reported_name
  FROM public.profiles
  WHERE id = p_reported_id;

  v_reason_label := CASE p_reason
    WHEN 'harassment' THEN 'Chikane eller trusler'
    WHEN 'spam' THEN 'Spam eller reklame'
    WHEN 'inappropriate' THEN 'Upassende indhold'
    ELSE 'Andet'
  END;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT
        p.id,
        'user_report',
        'Ny spilleranmeldelse',
        format(
          '%s har anmeldt %s (%s). Gå til Admin → Anmeldelser for at gennemgå.',
          v_reporter_name,
          v_reported_name,
          v_reason_label
        ),
        NULL,
        false
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin';
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.report_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, text) TO authenticated;

-- ─── 8) Policies: role=admin → is_admin() (PIN) ─────────────────────────────

DROP POLICY IF EXISTS "join_req_admin" ON public.match_join_requests;
CREATE POLICY "join_req_admin" ON public.match_join_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "americano_participants_admin_delete" ON public.americano_participants;
CREATE POLICY "americano_participants_admin_delete"
  ON public.americano_participants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DO $$
BEGIN
  IF to_regclass('public.leagues') IS NOT NULL THEN
    DROP POLICY IF EXISTS leagues_admin_insert ON public.leagues;
    CREATE POLICY leagues_admin_insert ON public.leagues
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin());

    DROP POLICY IF EXISTS leagues_admin_update ON public.leagues;
    CREATE POLICY leagues_admin_update ON public.leagues
      FOR UPDATE TO authenticated
      USING (public.is_admin());

    DROP POLICY IF EXISTS leagues_admin_delete ON public.leagues;
    CREATE POLICY leagues_admin_delete ON public.leagues
      FOR DELETE TO authenticated
      USING (public.is_admin());
  END IF;

  IF to_regclass('public.league_participants') IS NOT NULL THEN
    DROP POLICY IF EXISTS league_participants_delete ON public.league_participants;
    CREATE POLICY league_participants_delete ON public.league_participants
      FOR DELETE TO authenticated
      USING (user_id = auth.uid() OR public.is_admin());
  END IF;

  IF to_regclass('public.league_matches') IS NOT NULL THEN
    DROP POLICY IF EXISTS league_matches_insert ON public.league_matches;
    CREATE POLICY league_matches_insert ON public.league_matches
      FOR INSERT TO authenticated
      WITH CHECK (public.is_admin());

    DROP POLICY IF EXISTS league_matches_update ON public.league_matches;
    CREATE POLICY league_matches_update ON public.league_matches
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.league_participants lp
          WHERE lp.id IN (league_matches.player1_id, league_matches.player2_id)
            AND lp.user_id = auth.uid()
        )
        OR public.is_admin()
      );
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
