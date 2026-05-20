-- Invitation + push alignment: external match/americano invites, report_user admin_ids for client push

-- ─── create_notification_for_user: match_invite + americano_invite til eksterne modtagere ───
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

  -- Americano-opretter inviterer spillere der ikke er tilmeldt endnu
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
    RETURN;
  END IF;

  -- Kamp-opretter/deltager inviterer spillere der ikke er i kampen endnu
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

-- ─── report_user: returner admin_ids + push-tekst til klient ─────────────────
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

REVOKE ALL ON FUNCTION public.report_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, text) TO authenticated;
