-- Notifications suite: league invite entity links, decline/accept types, dedup on entity events

-- ─── Dedup helper (24h default) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._skip_duplicate_entity_notification(
  p_user_id uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_hours integer DEFAULT 24
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
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

-- ─── create_notification_for_user: dedup for one-shot entity events ───────────
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
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
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

-- ─── Liga holdinvitation med deep link ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_league_invite(
  p_user_id uuid,
  p_league_id uuid,
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

CREATE OR REPLACE FUNCTION public.notify_league_invite_accepted(
  p_team_id uuid,
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

CREATE OR REPLACE FUNCTION public.notify_league_invite_declined(
  p_team_id uuid,
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

REVOKE ALL ON FUNCTION public._skip_duplicate_entity_notification(uuid, text, text, uuid, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.notify_league_invite(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite(uuid, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_league_invite_declined(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite_declined(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_league_invite_accepted(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_league_invite_accepted(uuid, text, text) TO authenticated;
