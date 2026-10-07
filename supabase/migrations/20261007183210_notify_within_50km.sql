-- Beskeder om nye makkere og kampe gaar til spillere inden for 50 km.
--
-- Ejeren 7. okt. 2026 fik "I matcher som makkere" om en spiller i Herning
-- (ca. 120 km fra Noerresundby), fordi Vestjylland er nabo til Nordjylland.
-- Landsdele er for grove: samme landsdel kan vaere 130 km, og to naboer i hver
-- sin landsdel kan bo 10 km fra hinanden. Listen "Foreslaaede makkere" i appen
-- bruger allerede afstand (60 km); nu goer beskederne det ogsaa.
--
-- Reglen (notify_within_reach):
--   1. Har modtageren selv valgt en ANDEN landsdel i sit filter end den, hun
--      bor i, gaelder den landsdel (fx bor i Aalborg, spiller i Aarhus).
--   2. Kender vi begges by (koordinater): hoejst 50 km.
--   3. Ellers: kun samme landsdel - ikke laengere nabo-landsdelene.
-- Kampe maales fra opretterens by (banerne har ikke koordinater i databasen);
-- "jeg vil spille"-oensker fra det sted, spilleren har valgt for dagen.
-- Alt andet (niveau, dage, banehalvdel, graenser pr. dag osv.) er uaendret.

CREATE OR REPLACE FUNCTION public.notify_distance_km(
  p_a_lat double precision, p_a_lng double precision,
  p_b_lat double precision, p_b_lng double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p_a_lat IS NULL OR p_a_lng IS NULL OR p_b_lat IS NULL OR p_b_lng IS NULL THEN NULL
    -- (0, 0) er en tom standardvaerdi, ikke en rigtig by.
    WHEN (abs(p_a_lat) < 0.01 AND abs(p_a_lng) < 0.01) OR (abs(p_b_lat) < 0.01 AND abs(p_b_lng) < 0.01) THEN NULL
    ELSE 6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(p_b_lat - p_a_lat) / 2), 2)
      + cos(radians(p_a_lat)) * cos(radians(p_b_lat)) * power(sin(radians(p_b_lng - p_a_lng) / 2), 2)
    )))
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_within_reach(
  p_a_lat double precision, p_a_lng double precision, p_a_region text,
  p_b_lat double precision, p_b_lng double precision,
  p_b_home_region text, p_b_filter_region text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE
    -- 1. Modtageren har bevidst valgt en anden landsdel at spille i.
    WHEN COALESCE(p_b_filter_region, '') <> ''
         AND COALESCE(p_b_home_region, '') <> ''
         AND p_b_filter_region <> p_b_home_region
      THEN COALESCE(p_a_region, '') <> '' AND p_a_region = p_b_filter_region
    -- 2. Begge byer kendt: hoejst 50 km.
    WHEN public.notify_distance_km(p_a_lat, p_a_lng, p_b_lat, p_b_lng) IS NOT NULL
      THEN public.notify_distance_km(p_a_lat, p_a_lng, p_b_lat, p_b_lng) <= 50
    -- Uden landsdel hos afsenderen kan vi intet afgraense (som foer).
    WHEN COALESCE(p_a_region, '') = '' THEN true
    -- 3. Ellers kun samme landsdel.
    ELSE COALESCE(NULLIF(p_b_filter_region, ''), NULLIF(p_b_home_region, ''), '') = p_a_region
  END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_distance_km(double precision, double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_within_reach(double precision, double precision, text, double precision, double precision, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_distance_km(double precision, double precision, double precision, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_within_reach(double precision, double precision, text, double precision, double precision, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_makker_watchers(p_subject_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
DECLARE
  v_caller uuid := auth.uid();
  v_subject public.profiles%ROWTYPE;
  v_subject_level numeric;
  v_subject_name text;
  v_subject_region text;
  v_title text;
  v_body text;
  v_match_title text;
  v_notified integer := 0;
  v_recipient_ids uuid[] := '{}'::uuid[];
  v_match_recipient_ids uuid[] := '{}'::uuid[];
  v_matches jsonb := '[]'::jsonb;
  v_row record;
  v_daily integer;
  v_watcher_region text;
  v_watcher_days jsonb;
  v_subject_days jsonb;
  v_filt_lo numeric;
  v_filt_hi numeric;
  v_subject_lo numeric;
  v_subject_hi numeric;
  v_peer_level numeric;
  v_peer_name text;
  v_caller_body text;
  v_max_per_subject constant integer := 8;
  v_max_per_day constant integer := 5;
  v_max_unread constant integer := 3;
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

  -- Ingen udloebsgate laengere. Markeringen staar, til brugeren slaar den fra.

  IF v_caller IS DISTINCT FROM p_subject_user_id
     AND NOT COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun dig selv kan underrette makker-watchere');
  END IF;

  v_subject_level := public.match_filter_prefs_level('{}'::jsonb, v_subject.level::numeric);
  v_subject_name := COALESCE(NULLIF(trim(v_subject.full_name), ''), NULLIF(trim(v_subject.name), ''), 'En spiller');
  v_subject_region := public.canonical_app_region(
    COALESCE(NULLIF(btrim(COALESCE(v_subject.makker_search_prefs->>'region', '')), ''), v_subject.area, '')
  );
  v_subject_days := COALESCE(v_subject.makker_search_prefs->'days', '[]'::jsonb);
  IF v_subject_days IS NULL OR jsonb_typeof(v_subject_days) <> 'array' OR jsonb_array_length(v_subject_days) = 0 THEN
    v_subject_days := CASE
      WHEN v_subject.available_days IS NOT NULL AND array_length(v_subject.available_days, 1) > 0
      THEN to_jsonb(v_subject.available_days) ELSE '[]'::jsonb END;
  END IF;

  SELECT b.level_min, b.level_max INTO v_subject_lo, v_subject_hi
  FROM public.makker_filter_level_bounds(COALESCE(v_subject.makker_search_prefs, '{}'::jsonb), v_subject_level) b;

  v_title := 'Ny makker passer til dit filter';
  v_match_title := 'I matcher som makkere';
  v_body := format(
    '%s søger makker · Niveau ~%s%s',
    v_subject_name,
    public.format_padel_level(v_subject_level),
    CASE WHEN v_subject_region <> '' THEN ' · ' || v_subject_region ELSE '' END
  );

  IF public.makker_feed_is_active(v_subject.makker_search_prefs, v_subject.seeking_match_at)
     AND v_subject_region <> '' THEN
    FOR v_row IN
      SELECT p.id AS user_id, p.makker_search_prefs AS prefs, p.area, p.level,
             p.full_name, p.name, p.available_days, p.last_active_at
      FROM public.profiles p
      WHERE COALESCE(p.is_banned, false) = false
        AND p.id <> p_subject_user_id
        AND public.makker_feed_is_active(p.makker_search_prefs, p.seeking_match_at)
        AND public.notify_within_reach(
          v_subject.latitude, v_subject.longitude, v_subject_region,
          p.latitude, p.longitude,
          public.canonical_app_region(p.area),
          public.canonical_app_region(COALESCE(p.makker_search_prefs->>'region', ''))
        )
      ORDER BY p.last_active_at DESC NULLS LAST, p.id
      LIMIT v_max_per_subject * 4
    LOOP
      EXIT WHEN jsonb_array_length(v_matches) >= v_max_per_subject;
      v_watcher_region := public.canonical_app_region(
        COALESCE(NULLIF(btrim(COALESCE(v_row.prefs->>'region', '')), ''), v_row.area, '')
      );
      v_peer_level := public.match_filter_prefs_level(COALESCE(v_row.prefs, '{}'::jsonb), v_row.level::numeric);
      SELECT b.level_min, b.level_max INTO v_filt_lo, v_filt_hi
      FROM public.makker_filter_level_bounds(COALESCE(v_row.prefs, '{}'::jsonb), v_peer_level) b;
      IF v_subject_level < v_filt_lo OR v_subject_level > v_filt_hi THEN CONTINUE; END IF;
      IF v_peer_level < v_subject_lo OR v_peer_level > v_subject_hi THEN CONTINUE; END IF;

      v_watcher_days := COALESCE(v_row.prefs->'days', '[]'::jsonb);
      IF v_watcher_days IS NULL OR jsonb_typeof(v_watcher_days) <> 'array' OR jsonb_array_length(v_watcher_days) = 0 THEN
        v_watcher_days := CASE
          WHEN v_row.available_days IS NOT NULL AND array_length(v_row.available_days, 1) > 0
          THEN to_jsonb(v_row.available_days) ELSE '[]'::jsonb END;
      END IF;
      IF jsonb_array_length(v_watcher_days) > 0 AND jsonb_array_length(v_subject_days) > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_watcher_days) AS w(day_key)
          WHERE w.day_key IN (SELECT jsonb_array_elements_text(v_subject_days))
        ) THEN CONTINUE; END IF;
      END IF;

      v_peer_name := COALESCE(NULLIF(trim(v_row.full_name), ''), NULLIF(trim(v_row.name), ''), 'En spiller');

      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_row.user_id AND n.type = 'makker_suggestion'
          AND n.entity_type = 'profile' AND n.entity_id = p_subject_user_id
          AND n.created_at >= now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
        VALUES (v_row.user_id, 'makker_suggestion', v_match_title, v_body, NULL, 'profile', p_subject_user_id, false);
        v_notified := v_notified + 1;
        v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
        v_match_recipient_ids := array_append(v_match_recipient_ids, v_row.user_id);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p_subject_user_id AND n.type = 'makker_suggestion'
          AND n.entity_type = 'profile' AND n.entity_id = v_row.user_id
          AND n.created_at >= now() - interval '7 days'
      ) THEN
        v_caller_body := format(
          '%s søger også makker · Niveau ~%s%s',
          v_peer_name, public.format_padel_level(v_peer_level),
          CASE WHEN v_watcher_region <> '' THEN ' · ' || v_watcher_region ELSE '' END
        );
        INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
        VALUES (p_subject_user_id, 'makker_suggestion', v_match_title, v_caller_body, NULL, 'profile', v_row.user_id, false);
      END IF;

      v_matches := v_matches || jsonb_build_array(jsonb_build_object(
        'id', v_row.user_id, 'name', v_peer_name, 'region', v_watcher_region
      ));
    END LOOP;
  END IF;

  FOR v_row IN
    SELECT p.id AS user_id, p.makker_search_prefs AS prefs, p.area, p.level,
           p.court_side, p.match_watch_enabled, p.last_active_at
    FROM public.profiles p
    WHERE COALESCE(p.is_banned, false) = false
      AND p.id <> p_subject_user_id
      AND p.id <> ALL (v_recipient_ids)
      AND public.notify_within_reach(
        v_subject.latitude, v_subject.longitude, v_subject_region,
        p.latitude, p.longitude,
        public.canonical_app_region(p.area),
        public.canonical_app_region(COALESCE(p.makker_search_prefs->>'region', ''))
      )
      AND (
        COALESCE((p.makker_search_prefs->>'notify')::boolean, false) = true
        OR (
          p.makker_watch_enabled = true
          AND (
            p.makker_search_prefs IS NULL
            OR p.makker_search_prefs = '{}'::jsonb
            -- Har brugeren aldrig selv taget stilling, vinder knappen over
            -- det 'notify: false', der blev skrevet ind i filteret af sig selv.
            OR p.makker_watch_at IS NULL
          )
        )
      )
      AND (
        SELECT count(*) FROM public.notifications nu
        WHERE nu.user_id = p.id
          AND nu.type = 'makker_suggestion'
          AND nu.read = false
      ) < v_max_unread
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id AND n.type = 'makker_suggestion'
          AND n.entity_type = 'profile' AND n.entity_id = p_subject_user_id
          AND n.created_at >= now() - interval '7 days'
      )
    ORDER BY
      -- Naermeste foerst: graensen paa 8 skal bruges paa dem, der bor taettest.
      public.notify_distance_km(v_subject.latitude, v_subject.longitude, p.latitude, p.longitude) ASC NULLS LAST,
      p.last_active_at DESC NULLS LAST,
      p.id
    LIMIT v_max_per_subject * 4
  LOOP
    EXIT WHEN v_notified >= v_max_per_subject;
    v_watcher_region := public.canonical_app_region(
      COALESCE(NULLIF(btrim(COALESCE(v_row.prefs->>'region', '')), ''), v_row.area, '')
    );
    SELECT b.level_min, b.level_max INTO v_filt_lo, v_filt_hi
    FROM public.makker_filter_level_bounds(
      COALESCE(v_row.prefs, '{}'::jsonb),
      public.match_filter_prefs_level(COALESCE(v_row.prefs, '{}'::jsonb), v_row.level::numeric)
    ) b;
    IF v_subject_level < v_filt_lo OR v_subject_level > v_filt_hi THEN CONTINUE; END IF;

    IF NOT public.makker_filter_partner_court_side_ok(
      COALESCE(v_row.prefs, '{}'::jsonb), v_row.court_side, v_subject.court_side
    ) THEN CONTINUE; END IF;

    IF NOT public.makker_filter_play_style_ok(
      COALESCE(v_row.prefs->>'playStyle', 'all'), v_subject.play_style
    ) THEN CONTINUE; END IF;

    IF NOT public.makker_filter_intent_ok(
      COALESCE(v_row.prefs->'intents', '[]'::jsonb),
      COALESCE(v_row.prefs->>'intentMode', 'compatible'),
      v_subject.intent_now
    ) THEN CONTINUE; END IF;

    IF NOT public.makker_filter_availability_overlap(
      COALESCE(v_row.prefs->'availability', '[]'::jsonb), v_subject.availability
    ) THEN CONTINUE; END IF;

    v_watcher_days := COALESCE(v_row.prefs->'days', '[]'::jsonb);
    IF jsonb_array_length(v_watcher_days) > 0 THEN
      IF jsonb_array_length(v_subject_days) = 0 THEN
        NULL;
      ELSIF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_watcher_days) AS w(day_key)
        WHERE w.day_key IN (SELECT jsonb_array_elements_text(v_subject_days))
      ) THEN CONTINUE; END IF;
    END IF;

    v_daily := public.discovery_notifications_today_count(v_row.user_id, ARRAY['makker_suggestion']::text[]);
    IF v_daily >= v_max_per_day THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (v_row.user_id, 'makker_suggestion', v_title, v_body, NULL, 'profile', p_subject_user_id, false);
    v_notified := v_notified + 1;
    v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'notified', v_notified,
    'recipient_ids', to_jsonb(v_recipient_ids),
    'match_recipient_ids', to_jsonb(v_match_recipient_ids),
    'matches', v_matches,
    'notify_title', v_title,
    'notify_body', v_body,
    'match_title', v_match_title,
    'subject_level', v_subject_level
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_match_watchers(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
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
  v_match_min numeric;
  v_match_max numeric;
  v_max_per_match constant integer := 8;
  v_max_per_day constant integer := 5;
  v_max_unread constant integer := 3;
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
  -- Kampens niveau, som opretteren valgte det (fx 2.7-3.7).
  SELECT b.level_min, b.level_max INTO v_match_min, v_match_max
  FROM public.match_level_bounds(v_match.level_range, v_creator.level::numeric) b;

  v_title := 'Ny kamp passer til dig';
  v_body := format(
    'Åben kamp på %s%s%s · niveau %s–%s',
    COALESCE(NULLIF(trim(v_match.court_name), ''), 'en bane'),
    CASE WHEN v_match.date IS NOT NULL THEN ' · ' || to_char(v_match.date::date, 'DD/MM') ELSE '' END,
    CASE WHEN v_match.time IS NOT NULL THEN ' kl. ' || left(v_match.time::text, 5) ELSE '' END,
    to_char(v_match_min, 'FM0.0'),
    to_char(v_match_max, 'FM0.0')
  );

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
      AND public.play_intent_overlaps_match_time(i.start_time, i.end_time, v_match.time, v_match.time_end)
      AND (
        i.play_date > (timezone('Europe/Copenhagen', now()))::date
        OR (
          i.play_date = (timezone('Europe/Copenhagen', now()))::date
          AND i.end_time > (timezone('Europe/Copenhagen', now()))::time
        )
      )
      AND public.notify_within_reach(
        v_creator.latitude, v_creator.longitude, v_creator_region,
        COALESCE(i.latitude, p.latitude), COALESCE(i.longitude, p.longitude),
        public.canonical_app_region(p.area),
        public.canonical_app_region(COALESCE(NULLIF(btrim(COALESCE(i.region, '')), ''), p.match_search_prefs->>'region', ''))
      )
      AND public.match_fits_watcher_level(p.match_search_prefs, p.level::numeric, v_match_min, v_match_max)
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
      AND public.notify_within_reach(
        v_creator.latitude, v_creator.longitude, v_creator_region,
        p.latitude, p.longitude,
        public.canonical_app_region(p.area),
        public.canonical_app_region(COALESCE(p.match_search_prefs->>'region', ''))
      )
      AND public.match_fits_watcher_level(p.match_search_prefs, p.level::numeric, v_match_min, v_match_max)
      AND (
        SELECT count(*) FROM public.notifications nu
        WHERE nu.user_id = p.id
          AND nu.type = 'match_watch_match'
          AND nu.read = false
      ) < v_max_unread
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'match_watch_match'
          AND n.match_id = p_match_id
          AND n.created_at >= now() - interval '7 days'
      )
    ORDER BY
      -- Naermeste foerst: graensen paa 8 skal bruges paa dem, der bor taettest.
      public.notify_distance_km(v_creator.latitude, v_creator.longitude, p.latitude, p.longitude) ASC NULLS LAST,
      (CASE WHEN p.seeking_match = true THEN 1 ELSE 0 END) DESC,
      p.last_active_at DESC NULLS LAST,
      p.id
    LIMIT v_max_per_match * 3
  LOOP
    EXIT WHEN v_notified >= v_max_per_match;
    v_daily := public.discovery_notifications_today_count(v_row.user_id, ARRAY['match_watch_match']::text[]);
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
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$fn$;
