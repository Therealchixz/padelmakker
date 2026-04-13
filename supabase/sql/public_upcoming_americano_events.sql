-- =============================================================================
-- Offentlig liste: kommende Americano-turneringer (til forsiden /events uden login)
--
-- Eksponerer KUN ikke-følsomme felter: navn, dato, tid, pladser, status, bane-navn.
-- Ingen deltager-liste, ingen creator_id i output.
--
-- Kør i Supabase SQL Editor én gang. Kræves for at /events kan hente data med anon key.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.public_upcoming_americano_events(p_limit integer DEFAULT 24)
RETURNS TABLE (
  id uuid,
  name text,
  tournament_date date,
  time_slot text,
  player_slots integer,
  points_per_match integer,
  status text,
  description text,
  participant_count bigint,
  court_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  -- participant_count via LEFT JOIN + GROUP BY (undgår N+1 correlated subquery)
  SELECT
    t.id,
    t.name,
    t.tournament_date,
    t.time_slot,
    t.player_slots,
    t.points_per_match,
    t.status,
    t.description,
    count(p.id)::bigint AS participant_count,
    c.name AS court_name
  FROM public.americano_tournaments t
  LEFT JOIN public.courts c ON c.id = t.court_id
  LEFT JOIN public.americano_participants p ON p.tournament_id = t.id
  WHERE
    t.tournament_date >= (timezone('Europe/Copenhagen', now()))::date
    AND t.status IN ('registration', 'playing')
  GROUP BY t.id, c.id
  ORDER BY t.tournament_date ASC, t.time_slot ASC, t.created_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 24), 100));
$$;

REVOKE ALL ON FUNCTION public.public_upcoming_americano_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_upcoming_americano_events(integer) TO anon, authenticated;

COMMENT ON FUNCTION public.public_upcoming_americano_events(integer) IS
  'Offentlig: kommende Americano (registration/playing) til marketing /events — uden persondata.';
