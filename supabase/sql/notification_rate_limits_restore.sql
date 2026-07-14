-- Restore rate limits on create_notification_for_user (7-param) + batch helper.

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
