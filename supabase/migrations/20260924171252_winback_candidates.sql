-- Engangsmail til dem, der ikke har været inde i appen i 30 dage.
--
-- Målt 24. sep. 2026: 79 af 99 brugere har ikke været inde i 30 dage, og 58
-- af dem var kun inde den dag, de oprettede sig. De fleste nåede aldrig at se
-- en kamp, for der var ingen. Nu er der nogle, og appen kan mere.
--
-- get_winback_candidates() finder pr. person:
--   - åbne kampe fremover på deres niveau i deres region eller en nabo-region
--     (samme niveau-regel som besked om nye kampe: match_fits_watcher_level)
--   - spillere der søger makker, har været inde inden for 30 dage, er i
--     regionen eller en nabo-region, og hvis niveau passer. Har personen selv
--     valgt fra-til i makker-filteret, gælder det; ellers eget niveau ±0,75.
--
-- Kun dem, der har sagt ja til mails om nye kampe og makkere
-- (email.opdagelse = true, samme regel som den daglige mail), som ikke er
-- udelukket, og som ikke har fået en engangsmail det seneste år
-- (email_send_log, kind 'winback'). Kaldes kun af send-winback.

CREATE OR REPLACE FUNCTION public.get_winback_candidates(p_inactive_days integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  region text,
  match_ids uuid[],
  player_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
  WITH people AS (
    SELECT
      p.id,
      NULLIF(split_part(btrim(COALESCE(NULLIF(btrim(p.full_name), ''), p.name, '')), ' ', 1), '') AS first_name,
      public.match_watcher_region(p.match_search_prefs, p.area) AS region,
      p.match_search_prefs,
      p.makker_search_prefs,
      p.level::numeric AS level
    FROM public.profiles p
    WHERE COALESCE(p.is_banned, false) = false
      AND COALESCE(p.last_active_at, p.created_at) < now() - make_interval(days => GREATEST(1, COALESCE(p_inactive_days, 30)))
      AND COALESCE(p.notification_prefs -> 'email' ->> 'opdagelse', '') = 'true'
      AND NOT EXISTS (
        SELECT 1 FROM public.email_send_log l
        WHERE l.user_id = p.id
          AND l.kind = 'winback'
          AND l.sent_at >= now() - interval '365 days'
      )
  ),
  open_matches AS (
    SELECT
      m.id,
      m.creator_id,
      m.date,
      m.time,
      public.canonical_app_region(cr.area) AS creator_region,
      b.level_min,
      b.level_max
    FROM public.matches m
    JOIN public.profiles cr ON cr.id = m.creator_id
    CROSS JOIN LATERAL public.match_level_bounds(m.level_range, cr.level::numeric) b
    WHERE COALESCE(m.status, '') = 'open'
      AND COALESCE(m.match_type, 'open') <> 'closed'
      AND COALESCE(m.current_players, 0) < COALESCE(m.max_players, 4)
      AND m.date IS NOT NULL
      AND ((m.date + COALESCE(public.parse_clock_time(m.time), time '23:59'))
            AT TIME ZONE 'Europe/Copenhagen') > now()
  ),
  seekers AS (
    SELECT s.id, public.canonical_app_region(s.area) AS region, s.level::numeric AS level,
      COALESCE(s.last_active_at, s.created_at) AS seen_at
    FROM public.profiles s
    WHERE COALESCE(s.is_banned, false) = false
      AND public.makker_feed_is_active(s.makker_search_prefs, s.seeking_match_at)
      AND COALESCE(s.last_active_at, s.created_at) >= now() - interval '30 days'
  )
  SELECT
    pe.id AS user_id,
    pe.first_name,
    pe.region,
    COALESCE(ARRAY(
      SELECT om.id
      FROM open_matches om
      WHERE om.creator_id <> pe.id
        AND om.creator_region = ANY (public.app_region_neighbours(pe.region))
        AND public.match_fits_watcher_level(pe.match_search_prefs, pe.level, om.level_min, om.level_max)
        AND NOT EXISTS (
          SELECT 1 FROM public.match_players mp
          WHERE mp.match_id = om.id AND mp.user_id = pe.id
        )
      ORDER BY om.date, om.time
      LIMIT 5
    ), '{}'::uuid[]) AS match_ids,
    COALESCE(ARRAY(
      SELECT sk.id
      FROM seekers sk
      CROSS JOIN LATERAL (
        SELECT
          CASE WHEN custom.lo IS NOT NULL AND custom.hi IS NOT NULL THEN LEAST(custom.lo, custom.hi)
            ELSE GREATEST(1.0, COALESCE(pe.level, 3.0) - 0.75) END AS lo,
          CASE WHEN custom.lo IS NOT NULL AND custom.hi IS NOT NULL THEN GREATEST(custom.lo, custom.hi)
            ELSE LEAST(7.0, COALESCE(pe.level, 3.0) + 0.75) END AS hi
        FROM (
          SELECT
            CASE WHEN btrim(COALESCE(pe.makker_search_prefs->>'levelMin', '')) ~ '^[0-9]+(\.[0-9]+)?$'
              THEN btrim(pe.makker_search_prefs->>'levelMin')::numeric END AS lo,
            CASE WHEN btrim(COALESCE(pe.makker_search_prefs->>'levelMax', '')) ~ '^[0-9]+(\.[0-9]+)?$'
              THEN btrim(pe.makker_search_prefs->>'levelMax')::numeric END AS hi
        ) custom
      ) w
      WHERE sk.id <> pe.id
        AND sk.region = ANY (public.app_region_neighbours(pe.region))
        AND sk.level IS NOT NULL
        AND sk.level BETWEEN w.lo AND w.hi
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks ub
          WHERE (ub.blocker_id = pe.id AND ub.blocked_id = sk.id)
             OR (ub.blocker_id = sk.id AND ub.blocked_id = pe.id)
        )
      ORDER BY (sk.region = pe.region) DESC, abs(sk.level - COALESCE(pe.level, 3.0)), sk.seen_at DESC
      LIMIT 5
    ), '{}'::uuid[]) AS player_ids
  FROM people pe;
$fn$;

REVOKE ALL ON FUNCTION public.get_winback_candidates(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_winback_candidates(integer) TO service_role;
