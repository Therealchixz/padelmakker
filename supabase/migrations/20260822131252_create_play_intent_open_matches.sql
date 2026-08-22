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
