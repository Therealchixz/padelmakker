-- Besked om nye kampe bruger regionen fra kamp-filteret.
--
-- Før brugte notify_match_watchers modtagerens profil-region (profiles.area),
-- ikke den region, man vælger i kamp-filteret. Man kunne altså skifte region i
-- filteret uden at det ændrede, hvilke kampe man fik besked om. Makker-
-- beskederne bruger allerede filterets region (makker_search_prefs->>'region').
--
-- Nu: filterets region, ellers profilens. Nabo-regionerne gælder stadig.
-- Målt 24. sep. 2026: 0 af 99 modtagere har en filter-region, der afviger fra
-- profilen, så ingen får andre beskeder i dag.

CREATE OR REPLACE FUNCTION public.match_watcher_region(p_prefs jsonb, p_area text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT public.canonical_app_region(
    COALESCE(NULLIF(btrim(COALESCE(p_prefs->>'region', '')), ''), p_area, '')
  );
$fn$;

REVOKE ALL ON FUNCTION public.match_watcher_region(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_watcher_region(jsonb, text) TO service_role;

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
  v_regions text[];
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
  v_regions := public.app_region_neighbours(v_creator_region);
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
      AND (
        v_creator_region = ''
        OR i.region = ANY (v_regions)
        OR public.match_watcher_region(p.match_search_prefs, p.area) = ANY (v_regions)
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
      AND (
        v_creator_region = ''
        OR public.match_watcher_region(p.match_search_prefs, p.area) = ANY (v_regions)
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
      -- Naermeste foerst: graensen paa 8 skal bruges paa dem i samme region,
      -- foer den bruges paa naboerne.
      (CASE WHEN public.match_watcher_region(p.match_search_prefs, p.area) = v_creator_region THEN 1 ELSE 0 END) DESC,
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
