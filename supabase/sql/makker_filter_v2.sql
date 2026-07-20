-- Mit makker-filter v2: baneside, spillestil, intention, niveau-retning, tilgængelighed.

CREATE OR REPLACE FUNCTION public.makker_filter_normalize_side(p_side text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_side, '')) LIKE '%venstre%' THEN 'venstre'
    WHEN lower(coalesce(p_side, '')) LIKE '%højre%' OR lower(coalesce(p_side, '')) LIKE '%hojre%' THEN 'hojre'
    WHEN lower(coalesce(p_side, '')) LIKE '%begge%' THEN 'begge'
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_court_side_ok(
  p_mode text,
  p_watcher_side text,
  p_subject_side text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(NULLIF(trim(p_mode), ''), 'complementary')
    WHEN 'any' THEN true
    WHEN 'complementary' THEN (
      (public.makker_filter_normalize_side(p_watcher_side) = 'venstre'
        AND public.makker_filter_normalize_side(p_subject_side) = 'hojre')
      OR (public.makker_filter_normalize_side(p_watcher_side) = 'hojre'
        AND public.makker_filter_normalize_side(p_subject_side) = 'venstre')
      OR public.makker_filter_normalize_side(p_watcher_side) = 'begge'
      OR public.makker_filter_normalize_side(p_subject_side) = 'begge'
    )
    WHEN 'same' THEN (
      public.makker_filter_normalize_side(p_watcher_side) <> ''
      AND public.makker_filter_normalize_side(p_watcher_side) = public.makker_filter_normalize_side(p_subject_side)
    )
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_normalize_intent(p_intent text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_intent, '')) LIKE '%konkurrence%' THEN 'konkurrence'
    WHEN lower(coalesce(p_intent, '')) LIKE '%træning%' OR lower(coalesce(p_intent, '')) LIKE '%traening%' THEN 'traening'
    WHEN lower(coalesce(p_intent, '')) LIKE '%hygge%' THEN 'hygge'
    WHEN lower(coalesce(p_intent, '')) LIKE '%fast%' THEN 'fast_makker'
    WHEN lower(coalesce(p_intent, '')) LIKE '%turnering%' THEN 'turnering'
    ELSE lower(trim(coalesce(p_intent, '')))
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_intent_compat_score(p_a text, p_b text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE public.makker_filter_normalize_intent(p_a)
    WHEN 'konkurrence' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 1.0 WHEN 'traening' THEN 0.6 WHEN 'hygge' THEN 0.2
      WHEN 'fast_makker' THEN 0.5 WHEN 'turnering' THEN 0.8 ELSE 0.4 END
    WHEN 'traening' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.6 WHEN 'traening' THEN 1.0 WHEN 'hygge' THEN 0.5
      WHEN 'fast_makker' THEN 0.7 WHEN 'turnering' THEN 0.5 ELSE 0.4 END
    WHEN 'hygge' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.2 WHEN 'traening' THEN 0.5 WHEN 'hygge' THEN 1.0
      WHEN 'fast_makker' THEN 0.8 WHEN 'turnering' THEN 0.3 ELSE 0.4 END
    WHEN 'fast_makker' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.5 WHEN 'traening' THEN 0.7 WHEN 'hygge' THEN 0.8
      WHEN 'fast_makker' THEN 1.0 WHEN 'turnering' THEN 0.4 ELSE 0.4 END
    WHEN 'turnering' THEN CASE public.makker_filter_normalize_intent(p_b)
      WHEN 'konkurrence' THEN 0.8 WHEN 'traening' THEN 0.5 WHEN 'hygge' THEN 0.3
      WHEN 'fast_makker' THEN 0.4 WHEN 'turnering' THEN 1.0 ELSE 0.4 END
    ELSE 0.4
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_intent_ok(
  p_intents jsonb,
  p_mode text,
  p_subject_intent text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_intents IS NULL OR jsonb_array_length(p_intents) = 0 THEN true
    WHEN NULLIF(trim(coalesce(p_subject_intent, '')), '') IS NULL THEN true
    WHEN COALESCE(NULLIF(trim(p_mode), ''), 'compatible') = 'exact' THEN
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(p_intents) AS i(key)
        WHERE public.makker_filter_normalize_intent(i.key)
          = public.makker_filter_normalize_intent(p_subject_intent)
      )
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_intents) AS i(key)
      WHERE public.makker_filter_intent_compat_score(i.key, p_subject_intent) >= 0.6
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_play_style_ok(p_filter_style text, p_subject_style text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    COALESCE(NULLIF(trim(p_filter_style), ''), 'all') = 'all'
    OR NULLIF(trim(coalesce(p_subject_style, '')), '') IS NULL
    OR trim(p_subject_style) = 'Ved ikke endnu'
    OR trim(p_subject_style) = trim(p_filter_style);
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_availability_overlap(p_filter jsonb, p_subject text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_filter IS NULL OR jsonb_array_length(p_filter) = 0 THEN true
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_filter) AS f(slot)
      WHERE lower(trim(f.slot)) = 'flexibel'
    ) THEN true
    WHEN p_subject IS NULL OR array_length(p_subject, 1) IS NULL OR array_length(p_subject, 1) = 0 THEN true
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_filter) AS f(slot)
      WHERE lower(trim(f.slot)) = ANY (
        SELECT lower(trim(x)) FROM unnest(p_subject) AS x
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_level_bounds(
  p_prefs jsonb,
  p_watcher_level numeric
)
RETURNS TABLE (level_min numeric, level_max numeric)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE COALESCE(NULLIF(trim(p_prefs->>'partnerLevel'), ''), '')
      WHEN 'wide' THEN 1.0
      WHEN 'stronger' THEN GREATEST(1.0, public.match_filter_prefs_level(p_prefs, p_watcher_level))
      WHEN 'weaker' THEN GREATEST(1.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        - public.match_filter_level_window_from_prefs(p_prefs) - 0.15)
      ELSE GREATEST(1.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        - public.match_filter_level_window_from_prefs(p_prefs))
    END AS level_min,
    CASE COALESCE(NULLIF(trim(p_prefs->>'partnerLevel'), ''), '')
      WHEN 'wide' THEN 7.0
      WHEN 'stronger' THEN LEAST(7.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        + public.match_filter_level_window_from_prefs(p_prefs) + 0.15)
      WHEN 'weaker' THEN LEAST(7.0, public.match_filter_prefs_level(p_prefs, p_watcher_level))
      ELSE LEAST(7.0,
        public.match_filter_prefs_level(p_prefs, p_watcher_level)
        + public.match_filter_level_window_from_prefs(p_prefs))
    END AS level_max;
$$;

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
