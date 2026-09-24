-- Besked om nye kampe følger niveauet.
--
-- Før: notify_match_watchers sendte til alle, hvis ELO lå inden for 250 point
-- af OPRETTERENS ELO (~3,75 niveauer). Hverken kampens eget niveau (fx 2,7-3,7,
-- valgt ved oprettelse) eller modtagerens kamp-filter blev brugt, så en 5,0-
-- spiller kunne få besked om en kamp for 2,7-3,7.
--
-- Nu (ejerens beslutning 24. sep. 2026): man får kun besked, når kampen passer
-- inden for den ramme, man selv har valgt:
--   * Har man valgt et spænd i kamp-filteret (levelMin/levelMax), skal det
--     overlappe kampens niveau.
--   * Ellers skal ens eget niveau ligge inden for kampens niveau.
-- Kampens niveau læses fra matches.level_range ("elo:913-980|booked:no"). Har
-- kampen intet niveau, bruges opretterens niveau ±0,5 (samme som standarden i
-- Opret kamp).
--
-- Samme regel i appen: matchFitsWatcherLevel i src/lib/padelLevelUtils.js.
-- Region, 7-dages-spærren, 8 pr. kamp og 5 om dagen er uændrede.

-- ELO -> niveau (samme omregning som eloToLevel i appen: 800 = 1,0; 400/6 pr. niveau).
CREATE OR REPLACE FUNCTION public.elo_to_playtomic_level(p_elo numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT round(GREATEST(1.0, LEAST(7.0, 1 + (p_elo - 800) / (400.0 / 6))), 1);
$fn$;

-- Kampens niveau-spænd.
CREATE OR REPLACE FUNCTION public.match_level_bounds(p_level_range text, p_creator_level numeric)
RETURNS TABLE(level_min numeric, level_max numeric)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  WITH r AS (
    SELECT regexp_match(coalesce(p_level_range, ''), 'elo:([0-9]{2,4})-([0-9]{2,4})', 'i') AS m
  ), c AS (
    SELECT GREATEST(1.0, LEAST(7.0, round(COALESCE(NULLIF(p_creator_level, 0), 3.0), 1))) AS lvl
  )
  SELECT
    CASE WHEN r.m IS NOT NULL
      THEN LEAST(public.elo_to_playtomic_level(r.m[1]::numeric), public.elo_to_playtomic_level(r.m[2]::numeric))
      ELSE GREATEST(1.0, c.lvl - 0.5)
    END,
    CASE WHEN r.m IS NOT NULL
      THEN GREATEST(public.elo_to_playtomic_level(r.m[1]::numeric), public.elo_to_playtomic_level(r.m[2]::numeric))
      ELSE LEAST(7.0, c.lvl + 0.5)
    END
  FROM r, c;
$fn$;

-- Passer kampen (p_match_min-p_match_max) til modtagerens ramme?
CREATE OR REPLACE FUNCTION public.match_fits_watcher_level(
  p_prefs jsonb,
  p_watcher_level numeric,
  p_match_min numeric,
  p_match_max numeric
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  WITH custom AS (
    SELECT
      CASE WHEN trim(coalesce(p_prefs->>'levelMin', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        THEN GREATEST(1.0, LEAST(7.0, round(trim(p_prefs->>'levelMin')::numeric, 1)))
      END AS lo,
      CASE WHEN trim(coalesce(p_prefs->>'levelMax', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        THEN GREATEST(1.0, LEAST(7.0, round(trim(p_prefs->>'levelMax')::numeric, 1)))
      END AS hi
  ), w AS (
    SELECT
      CASE WHEN c.lo IS NOT NULL AND c.hi IS NOT NULL THEN LEAST(c.lo, c.hi)
        ELSE round(public.match_filter_prefs_level(COALESCE(p_prefs, '{}'::jsonb), p_watcher_level), 1)
      END AS lo,
      CASE WHEN c.lo IS NOT NULL AND c.hi IS NOT NULL THEN GREATEST(c.lo, c.hi)
        ELSE round(public.match_filter_prefs_level(COALESCE(p_prefs, '{}'::jsonb), p_watcher_level), 1)
      END AS hi
    FROM custom c
  )
  SELECT w.lo <= p_match_max AND w.hi >= p_match_min FROM w;
$fn$;

-- Hjælperne kaldes kun inde fra notify_match_watchers (SECURITY DEFINER).
REVOKE ALL ON FUNCTION public.elo_to_playtomic_level(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_level_bounds(text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_fits_watcher_level(jsonb, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.elo_to_playtomic_level(numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_level_bounds(text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_fits_watcher_level(jsonb, numeric, numeric, numeric) TO service_role;

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
        OR public.canonical_app_region(p.area) = ANY (v_regions)
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
        OR public.canonical_app_region(p.area) = ANY (v_regions)
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
      (CASE WHEN public.canonical_app_region(p.area) = v_creator_region THEN 1 ELSE 0 END) DESC,
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

COMMENT ON COLUMN public.profiles.match_search_prefs IS 'Mit kamp-filter: { version, notify, feedVisible, region, levelWindow, levelMin, levelMax, days[], availability[], openOnly }';
