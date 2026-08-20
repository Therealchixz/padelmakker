-- Offentlige forhåndsvisninger til delbare kamp- og turneringslinks (uden login)

CREATE OR REPLACE FUNCTION public.public_match_preview(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_creator_name text;
  v_level text;
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  IF v_match.status IN ('cancelled', 'completed') THEN
    RETURN json_build_object('found', false, 'reason', 'not_available');
  END IF;

  IF v_match.status <> 'in_progress' AND v_match.date IS NOT NULL AND v_match.date < v_today THEN
    RETURN json_build_object('found', false, 'reason', 'past');
  END IF;

  SELECT coalesce(
    nullif(split_part(trim(p.full_name), ' ', 1), ''),
    nullif(trim(p.name), ''),
    'En spiller'
  )
  INTO v_creator_name
  FROM public.profiles p
  WHERE p.id = v_match.creator_id;

  v_level := coalesce(nullif(trim(v_match.level_range), ''), '');

  RETURN json_build_object(
    'found', true,
    'id', v_match.id,
    'court_name', coalesce(nullif(trim(v_match.court_name), ''), 'Padel'),
    'date', v_match.date,
    'time', v_match.time,
    'time_end', v_match.time_end,
    'status', v_match.status,
    'match_type', coalesce(v_match.match_type, 'open'),
    'level_range', v_level,
    'current_players', coalesce(v_match.current_players, 0),
    'max_players', coalesce(v_match.max_players, 4),
    'description', left(coalesce(trim(v_match.description), ''), 280),
    'creator_first_name', v_creator_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_match_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_match_preview(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_americano_preview(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_t public.americano_tournaments%ROWTYPE;
  v_court text;
  v_participants bigint;
  v_today date := (timezone('Europe/Copenhagen', now()))::date;
BEGIN
  SELECT * INTO v_t FROM public.americano_tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  IF v_t.status NOT IN ('registration', 'playing') THEN
    RETURN json_build_object('found', false, 'reason', 'not_available');
  END IF;

  IF v_t.tournament_date IS NOT NULL AND v_t.tournament_date < v_today AND v_t.status <> 'playing' THEN
    RETURN json_build_object('found', false, 'reason', 'past');
  END IF;

  SELECT c.name INTO v_court FROM public.courts c WHERE c.id = v_t.court_id;
  SELECT count(*)::bigint INTO v_participants
  FROM public.americano_participants ap
  WHERE ap.tournament_id = v_t.id;

  RETURN json_build_object(
    'found', true,
    'id', v_t.id,
    'name', v_t.name,
    'format', coalesce(v_t.format, 'americano'),
    'tournament_date', v_t.tournament_date,
    'time_slot', v_t.time_slot,
    'status', v_t.status,
    'player_slots', coalesce(v_t.player_slots, 0),
    'points_per_match', coalesce(v_t.points_per_match, 0),
    'participant_count', coalesce(v_participants, 0),
    'court_name', coalesce(nullif(trim(v_court), ''), 'Bane ikke angivet'),
    'description', left(coalesce(trim(v_t.description), ''), 280)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_americano_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_americano_preview(uuid) TO anon, authenticated;
