-- Migration 20260521074215_match_watch_discovery
-- Backfilled from sql:recovered/match_watch_discovery_schema.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Kamp-watch: kolonner + index (schema-del).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS match_watch_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS match_watch_at timestamptz;

COMMENT ON COLUMN public.profiles.match_watch_enabled IS
  'Bruger vil have besked når åbne kampe passer region og ELO.';
COMMENT ON COLUMN public.profiles.match_watch_at IS
  'Seneste aktivering af kamp-watch.';

CREATE INDEX IF NOT EXISTS idx_profiles_match_watch_active
  ON public.profiles (match_watch_enabled)
  WHERE match_watch_enabled = true AND COALESCE(is_banned, false) = false;

CREATE OR REPLACE FUNCTION public.discovery_notifications_today_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.type IN ('match_watch_match', 'makker_suggestion')
    AND n.created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Copenhagen');
$$;

REVOKE ALL ON FUNCTION public.discovery_notifications_today_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discovery_notifications_today_count(uuid) TO authenticated;
