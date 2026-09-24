-- Selvvalgt niveau i makker-filteret (fra-til).
--
-- Før kunne man kun vælge færdige spænd ud fra sit eget niveau (fx "tæt på
-- mit niveau" = ±0,2). Nu gemmer filteret levelMin/levelMax, når man selv
-- vælger fra og til på skyderen. Er de sat, gælder de; ellers bruges den gamle
-- beregning (partnerLevel + levelWindow), så eksisterende filtre virker som før.
--
-- Samme regel i appen: customMakkerLevelBounds i src/lib/makkerFilterMatch.js.

CREATE OR REPLACE FUNCTION public.makker_filter_level_bounds(p_prefs jsonb, p_watcher_level numeric)
RETURNS TABLE(level_min numeric, level_max numeric)
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $fn$
  WITH custom AS (
    SELECT
      CASE WHEN trim(coalesce(p_prefs->>'levelMin', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        THEN GREATEST(1.0, LEAST(7.0, round(trim(p_prefs->>'levelMin')::numeric, 1)))
      END AS lo,
      CASE WHEN trim(coalesce(p_prefs->>'levelMax', '')) ~ '^[0-9]+(\.[0-9]+)?$'
        THEN GREATEST(1.0, LEAST(7.0, round(trim(p_prefs->>'levelMax')::numeric, 1)))
      END AS hi
  )
  SELECT
    CASE
      WHEN c.lo IS NOT NULL AND c.hi IS NOT NULL THEN LEAST(c.lo, c.hi)
      ELSE CASE COALESCE(NULLIF(trim(p_prefs->>'partnerLevel'), ''), '')
        WHEN 'wide' THEN 1.0
        WHEN 'stronger' THEN GREATEST(1.0, public.match_filter_prefs_level(p_prefs, p_watcher_level))
        WHEN 'weaker' THEN GREATEST(1.0,
          public.match_filter_prefs_level(p_prefs, p_watcher_level)
          - public.match_filter_level_window_from_prefs(p_prefs) - 0.15)
        ELSE GREATEST(1.0,
          public.match_filter_prefs_level(p_prefs, p_watcher_level)
          - public.match_filter_level_window_from_prefs(p_prefs))
      END
    END AS level_min,
    CASE
      WHEN c.lo IS NOT NULL AND c.hi IS NOT NULL THEN GREATEST(c.lo, c.hi)
      ELSE CASE COALESCE(NULLIF(trim(p_prefs->>'partnerLevel'), ''), '')
        WHEN 'wide' THEN 7.0
        WHEN 'stronger' THEN LEAST(7.0,
          public.match_filter_prefs_level(p_prefs, p_watcher_level)
          + public.match_filter_level_window_from_prefs(p_prefs) + 0.15)
        WHEN 'weaker' THEN LEAST(7.0, public.match_filter_prefs_level(p_prefs, p_watcher_level))
        ELSE LEAST(7.0,
          public.match_filter_prefs_level(p_prefs, p_watcher_level)
          + public.match_filter_level_window_from_prefs(p_prefs))
      END
    END AS level_max
  FROM custom c;
$fn$;

COMMENT ON COLUMN public.profiles.makker_search_prefs IS 'Mit makker-filter v2: notify, feedVisible, region, levelWindow, levelMin, levelMax, days, partnerCourtSide, playStyle, intents, intentMode, partnerLevel, availability.';
