-- Discovery-notifikationer: separat daglig cap for kamp og makker (5 + 5, ikke 5 i alt).

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
