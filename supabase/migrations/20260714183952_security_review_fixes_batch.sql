-- Security review batch: atomic join/leave, chat counts, notification rate limits, misc hardening.

-- ─── 1) join_open_match + leave_match + block direct inserts ─────────────────

CREATE OR REPLACE FUNCTION public.join_open_match(
  p_match_id uuid,
  p_team int DEFAULT NULL,
  p_user_name text DEFAULT NULL,
  p_user_email text DEFAULT NULL,
  p_user_emoji text DEFAULT '🎾'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

  INSERT INTO public.match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (
    p_match_id,
    v_caller,
    coalesce(v_name, 'Spiller'),
    nullif(btrim(coalesce(p_user_email, '')), ''),
    coalesce(nullif(btrim(p_user_emoji), ''), '🎾'),
    v_team
  )
  ON CONFLICT DO NOTHING;

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
    'is_full', (v_t1 >= 2 AND v_t2 >= 2),
    'current_players', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

REVOKE ALL ON FUNCTION public.join_open_match(uuid, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, int, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.leave_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_match(uuid) TO authenticated;

DROP POLICY IF EXISTS "Brugere kan tilmelde sig selv" ON public.match_players;
DROP POLICY IF EXISTS match_players_insert_via_rpc_only ON public.match_players;
CREATE POLICY match_players_insert_via_rpc_only
  ON public.match_players FOR INSERT TO authenticated WITH CHECK (false);

-- ─── 2) Aggregated match chat counts ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fetch_match_message_counts(p_match_ids uuid[])
RETURNS TABLE(match_id uuid, message_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
  SELECT mm.match_id, COUNT(*)::bigint
  FROM public.match_messages mm
  WHERE p_match_ids IS NOT NULL AND cardinality(p_match_ids) > 0 AND mm.match_id = ANY(p_match_ids)
  GROUP BY mm.match_id;
$$;
REVOKE ALL ON FUNCTION public.fetch_match_message_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_match_message_counts(uuid[]) TO authenticated;

-- ─── 3) Lock down check_rate_limit (service_role only) ───────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.check_rate_limit(text,bigint,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.check_rate_limit(text, bigint, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.check_rate_limit(text, bigint, integer) FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, bigint, integer) TO service_role;
  END IF;
END $$;

-- ─── 4) notify_match_creator_on_join: rate limit + dedup ─────────────────────
CREATE OR REPLACE FUNCTION public.notify_match_creator_on_join(
  p_match_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

-- ─── 5) create_notification_for_user: restore rate limits (7-param) ──────────
CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_et text := nullif(lower(trim(coalesce(p_entity_type, ''))), '');
  v_last_notified timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

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
    IF NOT EXISTS (
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
    IF NOT EXISTS (
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

  IF EXISTS (
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

CREATE OR REPLACE FUNCTION public.create_notifications_for_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    BEGIN
      PERFORM public.create_notification_for_user(
        v_uid, p_type, p_title, p_body, p_match_id, p_entity_type, p_entity_id
      );
      v_count := v_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLSTATE = 'P0001'
           OR position('Ingen adgang' in SQLERRM) > 0
           OR position('Vent 30 min' in SQLERRM) > 0
           OR position('For mange' in SQLERRM) > 0
           OR position('Rate limit' in SQLERRM) > 0
           OR position('Manglende' in SQLERRM) > 0 THEN
          RAISE;
        END IF;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─── 6) Americano score: row lock ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_americano_match_score(
  p_match_id uuid,
  p_score_a int,
  p_score_b int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_match public.americano_matches%ROWTYPE;
  v_ppm int;
  v_status text;
  v_is_player boolean;
  v_earlier_open boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_match FROM public.americano_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF COALESCE(v_match.results_locked, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_locked');
  END IF;

  SELECT status, points_per_match INTO v_status, v_ppm
  FROM public.americano_tournaments WHERE id = v_match.tournament_id;
  IF v_status <> 'playing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'tournament_not_playing');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.americano_participants ap
    WHERE ap.user_id = v_uid
      AND ap.id IN (v_match.team_a_p1, v_match.team_a_p2, v_match.team_b_p1, v_match.team_b_p2)
  ) INTO v_is_player;
  IF NOT v_is_player THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_on_court');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.americano_matches am
    WHERE am.tournament_id = v_match.tournament_id
      AND am.round_number < v_match.round_number
      AND COALESCE(am.results_locked, false) = false
  ) INTO v_earlier_open;
  IF v_earlier_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'earlier_round_open');
  END IF;

  IF p_score_a IS NULL OR p_score_b IS NULL OR p_score_a < 0 OR p_score_b < 0
     OR (p_score_a + p_score_b) <> v_ppm THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_score');
  END IF;

  UPDATE public.americano_matches
  SET team_a_score = p_score_a,
      team_b_score = p_score_b,
      results_locked = true,
      updated_at = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── 7) match_photos: participant-only read ──────────────────────────────────
DROP POLICY IF EXISTS "match_photos_select" ON public.match_photos;
CREATE POLICY "match_photos_select" ON public.match_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = match_photos.match_id AND mp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_photos.match_id AND m.creator_id = auth.uid()
    )
    OR public.is_admin()
  );

-- ─── 8) Pending join-request index ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_match_join_requests_match_pending
  ON public.match_join_requests (match_id)
  WHERE status = 'pending';
