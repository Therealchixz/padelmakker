-- Kamp-filter: match på Playtomic-niveau (profiles.level + prefs), ikke ELO i UI.
-- ELO i level_range bruges kun til at udlede niveau-interval.

CREATE OR REPLACE FUNCTION public.padel_level_to_elo(p_level numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(400, LEAST(3000, ROUND(
    (800 + (GREATEST(1.0, LEAST(7.0, COALESCE(p_level, 3.0))) - 1.0) * (400.0 / 6.0))
  )::numeric)::integer);
$$;

CREATE OR REPLACE FUNCTION public.padel_elo_to_level(p_elo integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(
    GREATEST(1.0, LEAST(7.0,
      1.0 + (GREATEST(400, LEAST(3000, COALESCE(p_elo, 1000))) - 800)::numeric / (400.0 / 6.0)
    ))::numeric,
    1
  );
$$;

CREATE OR REPLACE FUNCTION public.match_filter_level_window_from_prefs(p_prefs jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
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

CREATE OR REPLACE FUNCTION public.match_filter_prefs_level(p_prefs jsonb, p_profile_level numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1.0, LEAST(7.0,
    COALESCE(
      NULLIF(p_profile_level, 0),
      NULLIF(trim(p_prefs->>'myLevel'), '')::numeric,
      3.0
    )
  ));
$$;

CREATE OR REPLACE FUNCTION public.notify_match_watchers(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_match public.matches%ROWTYPE;
  v_creator public.profiles%ROWTYPE;
  v_match_level numeric;
  v_title text;
  v_body text;
  v_notified integer := 0;
  v_recipient_ids uuid[] := '{}'::uuid[];
  v_row record;
  v_daily integer;
  v_watcher_region text;
  v_watcher_days jsonb;
  v_match_dow_key text;
  v_watcher_level numeric;
  v_watcher_window numeric;
  v_creator_level numeric;
  v_range_lo integer;
  v_range_hi integer;
  v_range_level_lo numeric;
  v_range_level_hi numeric;
  v_filt_lo numeric;
  v_filt_hi numeric;
  v_max_per_match constant integer := 8;
  v_max_per_day constant integer := 5;
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
  v_creator_level := public.match_filter_prefs_level('{}'::jsonb, v_creator.level);
  v_match_level := v_creator_level;

  v_match_dow_key := CASE EXTRACT(ISODOW FROM v_match.date::date)::integer
    WHEN 1 THEN 'mon'
    WHEN 2 THEN 'tue'
    WHEN 3 THEN 'wed'
    WHEN 4 THEN 'thu'
    WHEN 5 THEN 'fri'
    WHEN 6 THEN 'sat'
    WHEN 7 THEN 'sun'
    ELSE NULL
  END;

  v_title := 'Ny kamp passer til dit filter';
  v_body := format(
    'Åben kamp på %s%s%s · Niveau ~%s',
    COALESCE(NULLIF(trim(v_match.court_name), ''), 'en bane'),
    CASE WHEN v_match.date IS NOT NULL THEN ' · ' || to_char(v_match.date::date, 'DD/MM') ELSE '' END,
    CASE WHEN v_match.time IS NOT NULL THEN ' kl. ' || left(v_match.time::text, 5) ELSE '' END,
    trim(to_char(v_match_level, 'FM9.9'))
  );

  FOR v_row IN
    SELECT p.id AS user_id, p.match_search_prefs AS prefs, p.area, p.level,
           p.seeking_match, p.last_active_at
    FROM public.profiles p
    WHERE COALESCE(p.is_banned, false) = false
      AND p.id <> v_match.creator_id
      AND p.id <> ALL (
        SELECT mp.user_id FROM public.match_players mp WHERE mp.match_id = p_match_id
      )
      AND (
        COALESCE((p.match_search_prefs->>'notify')::boolean, false) = true
        OR (p.match_watch_enabled = true AND (p.match_search_prefs IS NULL OR p.match_search_prefs = '{}'::jsonb))
      )
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
      (CASE WHEN p.seeking_match = true OR COALESCE((p.match_search_prefs->>'feedVisible')::boolean, false) THEN 1 ELSE 0 END) DESC,
      p.last_active_at DESC NULLS LAST,
      p.id
    LIMIT v_max_per_match * 4
  LOOP
    EXIT WHEN v_notified >= v_max_per_match;

    v_watcher_region := NULLIF(trim(COALESCE(v_row.prefs->>'region', v_row.area, '')), '');
    IF NULLIF(trim(COALESCE(v_creator.area, '')), '') IS NOT NULL THEN
      IF v_watcher_region IS NULL OR lower(v_watcher_region) <> lower(trim(v_creator.area)) THEN
        CONTINUE;
      END IF;
    END IF;

    v_watcher_level := public.match_filter_prefs_level(v_row.prefs, v_row.level);
    v_watcher_window := public.match_filter_level_window_from_prefs(v_row.prefs);
    v_filt_lo := GREATEST(1.0, v_watcher_level - v_watcher_window);
    v_filt_hi := LEAST(7.0, v_watcher_level + v_watcher_window);

    IF v_creator_level < v_filt_lo OR v_creator_level > v_filt_hi THEN
      CONTINUE;
    END IF;

    v_range_lo := NULL;
    v_range_hi := NULL;
    IF v_match.level_range ~* 'elo:\d' THEN
      v_range_lo := (regexp_match(v_match.level_range, 'elo:(\d+)-(\d+)', 'i'))[1]::integer;
      v_range_hi := (regexp_match(v_match.level_range, 'elo:(\d+)-(\d+)', 'i'))[2]::integer;
      IF v_range_lo IS NOT NULL AND v_range_hi IS NOT NULL THEN
        v_range_level_lo := public.padel_elo_to_level(LEAST(v_range_lo, v_range_hi));
        v_range_level_hi := public.padel_elo_to_level(GREATEST(v_range_lo, v_range_hi));
        IF v_filt_hi < v_range_level_lo OR v_filt_lo > v_range_level_hi THEN
          CONTINUE;
        END IF;
      END IF;
    END IF;

    v_watcher_days := COALESCE(v_row.prefs->'days', '[]'::jsonb);
    IF jsonb_array_length(v_watcher_days) > 0 AND v_match_dow_key IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_watcher_days) AS d(day_key)
        WHERE d.day_key = v_match_dow_key
      ) THEN
        CONTINUE;
      END IF;
    END IF;

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
    'match_level', v_match_level
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_watchers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_watchers(uuid) TO authenticated;
