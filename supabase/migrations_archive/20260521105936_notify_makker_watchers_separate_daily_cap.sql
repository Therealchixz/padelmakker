-- Migration 20260521105936_notify_makker_watchers_separate_daily_cap
-- Backfilled from migration:20260528150000_discovery_notification_limits_separate.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Discovery-notifikationer: separat daglig cap for kamp og makker (2 + 2, ikke 2 i alt).

CREATE OR REPLACE FUNCTION public.discovery_notifications_today_count(
  p_user_id uuid,
  p_types text[] DEFAULT ARRAY['match_watch_match', 'makker_suggestion']::text[]
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.type = ANY (p_types)
    AND n.created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Copenhagen');
$$;

REVOKE ALL ON FUNCTION public.discovery_notifications_today_count(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_notifications_today_count(uuid, text[]) TO authenticated;

-- Bagudkompatibilitet: én-parameter = begge typer (undgås i nye notify-kald).
CREATE OR REPLACE FUNCTION public.discovery_notifications_today_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.discovery_notifications_today_count(
    p_user_id,
    ARRAY['match_watch_match', 'makker_suggestion']::text[]
  );
$$;

REVOKE ALL ON FUNCTION public.discovery_notifications_today_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_notifications_today_count(uuid) TO authenticated;


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
  v_max_per_day constant integer := 2;
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
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.match_watch_enabled = true
      AND COALESCE(p.is_banned, false) = false
      AND p.id <> v_match.creator_id
      AND p.id <> ALL (
        SELECT mp.user_id FROM public.match_players mp WHERE mp.match_id = p_match_id
      )
      AND (
        NULLIF(trim(COALESCE(v_creator.area, '')), '') IS NULL
        OR lower(trim(COALESCE(p.area, ''))) = lower(trim(v_creator.area))
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

REVOKE ALL ON FUNCTION public.notify_match_watchers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_watchers(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.notify_makker_watchers(p_subject_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_subject public.profiles%ROWTYPE;
  v_subject_level numeric;
  v_subject_name text;
  v_title text;
  v_body text;
  v_notified integer := 0;
  v_recipient_ids uuid[] := '{}'::uuid[];
  v_row record;
  v_daily integer;
  v_watcher_region text;
  v_watcher_days jsonb;
  v_subject_days jsonb;
  v_filt_lo numeric;
  v_filt_hi numeric;
  v_max_per_subject constant integer := 8;
  v_max_per_day constant integer := 2;
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

  v_subject_level := public.match_filter_prefs_level('{}'::jsonb, v_subject.level);
  v_subject_name := COALESCE(NULLIF(trim(v_subject.full_name), ''), NULLIF(trim(v_subject.name), ''), 'En spiller');
  v_subject_days := CASE
    WHEN v_subject.available_days IS NOT NULL AND array_length(v_subject.available_days, 1) > 0
    THEN to_jsonb(v_subject.available_days)
    ELSE '[]'::jsonb
  END;

  v_title := 'Ny makker passer til dit filter';
  v_body := format(
    '%s søger makker · Niveau ~%s%s',
    v_subject_name,
    trim(to_char(v_subject_level, 'FM9.9')),
    CASE WHEN NULLIF(trim(COALESCE(v_subject.area, '')), '') IS NOT NULL
      THEN ' · ' || trim(v_subject.area) ELSE '' END
  );

  FOR v_row IN
    SELECT p.id AS user_id, p.makker_search_prefs AS prefs, p.area, p.level, p.court_side,
           p.match_watch_enabled, p.last_active_at
    FROM public.profiles p
    WHERE COALESCE(p.is_banned, false) = false
      AND p.id <> p_subject_user_id
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

    v_watcher_region := NULLIF(trim(COALESCE(v_row.prefs->>'region', v_row.area, '')), '');
    IF NULLIF(trim(COALESCE(v_subject.area, '')), '') IS NOT NULL THEN
      IF v_watcher_region IS NULL OR lower(v_watcher_region) <> lower(trim(v_subject.area)) THEN
        CONTINUE;
      END IF;
    END IF;

    SELECT b.level_min, b.level_max INTO v_filt_lo, v_filt_hi
    FROM public.makker_filter_level_bounds(
      COALESCE(v_row.prefs, '{}'::jsonb),
      public.match_filter_prefs_level(COALESCE(v_row.prefs, '{}'::jsonb), v_row.level)
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
    'notify_title', v_title,
    'notify_body', v_body,
    'subject_level', v_subject_level
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON COLUMN public.profiles.makker_search_prefs IS
  'Mit makker-filter v2: notify, feedVisible, region, levelWindow, days, partnerCourtSide, playStyle, intents, intentMode, partnerLevel, availability.';
