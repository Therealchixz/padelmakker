-- Bro mellem "jeg vil spille" (play_intents) og åbne kampe.
--
-- En hensigt venter ikke kun på tre andre i puljen: den matcher også eksisterende
-- åbne kampe i samme dato/tidsrum/region, og en ny åben kamp notifierer omvendt
-- dem der allerede har meldt sig klar.

CREATE OR REPLACE FUNCTION public.parse_clock_time(p_value text)
RETURNS time
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
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

REVOKE ALL ON FUNCTION public.parse_clock_time(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.play_intent_overlaps_match_time(
  p_intent_start time,
  p_intent_end time,
  p_match_time text,
  p_match_time_end text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_start time;
  v_end time;
BEGIN
  IF p_intent_start IS NULL OR p_intent_end IS NULL OR p_intent_end <= p_intent_start THEN
    RETURN false;
  END IF;

  v_start := public.parse_clock_time(p_match_time);
  -- Kamp uden klokkeslæt: overlap på datoen (kalderen filtrerer play_date = match.date).
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

REVOKE ALL ON FUNCTION public.play_intent_overlaps_match_time(time, time, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notify_match_watchers(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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

  -- Fase 1: konkrete spilletider slår vag "søger kamp"-watch. Ingen daglig cap —
  -- brugeren har selv sagt hvornår de kan.
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
$function$;

REVOKE ALL ON FUNCTION public.notify_match_watchers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_watchers(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_play_intent(
  p_play_date date,
  p_start_time time,
  p_end_time time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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
    -- profiles.level er `real`; uden cast kan Postgres ikke slå funktionen op.
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
$function$;

REVOKE ALL ON FUNCTION public.create_play_intent(date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_play_intent(date, time, time) TO authenticated;
