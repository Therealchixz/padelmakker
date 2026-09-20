-- Migration 20260521094121_match_search_prefs_column
-- Backfilled from migration:20260523120000_match_search_filter.sql:1-35 (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Mit kamp-filter: gemte kriterier (region, ELO-vindue, ugedage) + notify/feed.
-- Erstatter skjult kamp-watch-logik; match_watch_enabled synkroniseres fra prefs.notify.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS match_search_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.match_search_prefs IS
  'Mit kamp-filter: { version, notify, feedVisible, region, eloWindow, days[], openOnly }';

-- Migrér eksisterende kamp-watch-brugere
UPDATE public.profiles p
SET match_search_prefs = jsonb_build_object(
  'version', 1,
  'notify', true,
  'feedVisible', COALESCE(p.seeking_match, false),
  'region', NULLIF(trim(COALESCE(p.area, '')), ''),
  'eloWindow', 250,
  'days', COALESCE(
    CASE
      WHEN p.available_days IS NOT NULL AND array_length(p.available_days, 1) > 0
      THEN to_jsonb(p.available_days)
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  ),
  'openOnly', true,
  'migratedFrom', 'match_watch_enabled'
)
WHERE p.match_watch_enabled = true
  AND (p.match_search_prefs IS NULL OR p.match_search_prefs = '{}'::jsonb);

CREATE OR REPLACE FUNCTION public.notify_match_watchers(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
