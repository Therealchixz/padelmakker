-- Mit makker-filter: makker_search_prefs + notify_makker_watchers (niveau + region).
-- Makker-notifikationer: max 5/dag (kamp-watch har egne 5/dag — se discovery_notification_limits.sql).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS makker_search_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS makker_watch_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS makker_watch_at timestamptz;

COMMENT ON COLUMN public.profiles.makker_search_prefs IS
  'Mit makker-filter: notify, feedVisible, region, myLevel, levelWindow, days (version 1).';

COMMENT ON COLUMN public.profiles.makker_watch_enabled IS
  'Synkroniseret fra makker_search_prefs.notify — modtag makker_suggestion.';

CREATE INDEX IF NOT EXISTS idx_profiles_makker_watch_active
  ON public.profiles (makker_watch_enabled)
  WHERE makker_watch_enabled = true AND COALESCE(is_banned, false) = false;

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
  v_watcher_level numeric;
  v_watcher_window numeric;
  v_filt_lo numeric;
  v_filt_hi numeric;
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
    SELECT p.id AS user_id, p.makker_search_prefs AS prefs, p.area, p.level,
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

    v_watcher_level := public.match_filter_prefs_level(v_row.prefs, v_row.level);
    v_watcher_window := public.match_filter_level_window_from_prefs(v_row.prefs);
    v_filt_lo := GREATEST(1.0, v_watcher_level - v_watcher_window);
    v_filt_hi := LEAST(7.0, v_watcher_level + v_watcher_window);

    IF v_subject_level < v_filt_lo OR v_subject_level > v_filt_hi THEN
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

REVOKE ALL ON FUNCTION public.notify_makker_watchers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_makker_watchers(uuid) TO authenticated;
