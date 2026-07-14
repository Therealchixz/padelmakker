-- Race-safe open match join + leave. Kør via migration eller Supabase MCP.

CREATE OR REPLACE FUNCTION public.join_open_match(
  p_match_id uuid,
  p_team int DEFAULT NULL,
  p_user_name text DEFAULT NULL,
  p_user_email text DEFAULT NULL,
  p_user_emoji text DEFAULT '🎾'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_match_type text;
  v_status text;
  v_t1 int;
  v_t2 int;
  v_total int;
  v_team int;
  v_name text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF public.is_banned() THEN
    RETURN jsonb_build_object('success', false, 'error', 'banned');
  END IF;

  IF to_regprocedure('public._rpc_rate_limit_or_raise(text,integer,integer)') IS NOT NULL THEN
    PERFORM public._rpc_rate_limit_or_raise('join_open_match', 60, 3600);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    SELECT mp.team INTO v_team
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller;
    RETURN jsonb_build_object('success', true, 'already_joined', true, 'team', v_team);
  END IF;

  SELECT lower(coalesce(m.match_type, 'open')), lower(coalesce(m.status, 'open'))
  INTO v_match_type, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_match_type = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_closed');
  END IF;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  SELECT COUNT(*) FILTER (WHERE team = 1),
         COUNT(*) FILTER (WHERE team = 2),
         COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_total >= 4 OR (v_t1 >= 2 AND v_t2 >= 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_full');
  END IF;

  IF p_team IS NOT NULL THEN
    IF p_team NOT IN (1, 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_team');
    END IF;
    v_team := p_team;
    IF (v_team = 1 AND v_t1 >= 2) OR (v_team = 2 AND v_t2 >= 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team);
    END IF;
  ELSE
    v_team := CASE WHEN v_t1 <= v_t2 THEN 1 ELSE 2 END;
    IF (v_team = 1 AND v_t1 >= 2) OR (v_team = 2 AND v_t2 >= 2) THEN
      v_team := CASE WHEN v_team = 1 THEN 2 ELSE 1 END;
    END IF;
    IF (v_team = 1 AND v_t1 >= 2) OR (v_team = 2 AND v_t2 >= 2) THEN
      RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team);
    END IF;
  END IF;

  v_name := nullif(btrim(coalesce(p_user_name, '')), '');
  IF v_name IS NULL THEN
    SELECT coalesce(nullif(btrim(full_name), ''), nullif(btrim(name), ''), 'Spiller')
    INTO v_name
    FROM public.profiles
    WHERE id = v_caller;
  END IF;

  INSERT INTO public.match_players (match_id, user_id, user_name, user_email, user_emoji, team)
  VALUES (
    p_match_id,
    v_caller,
    coalesce(v_name, 'Spiller'),
    nullif(btrim(coalesce(p_user_email, '')), ''),
    coalesce(nullif(btrim(p_user_emoji), ''), '🎾'),
    v_team
  )
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'insert_failed');
  END IF;

  SELECT COUNT(*) FILTER (WHERE team = 1),
         COUNT(*) FILTER (WHERE team = 2),
         COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_t1 > 2 OR v_t2 > 2 THEN
    DELETE FROM public.match_players
    WHERE match_id = p_match_id AND user_id = v_caller;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', v_team);
  END IF;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE public.matches
    SET status = 'full', current_players = v_total, seeking_player = false
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches
    SET status = 'open', current_players = v_total
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'team', v_team,
    'is_full', (v_t1 >= 2 AND v_t2 >= 2),
    'current_players', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_creator_id uuid;
  v_status text;
  v_remaining int;
  v_new_creator uuid;
  v_was_creator boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_locked');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_match');
  END IF;

  v_was_creator := (v_creator_id = v_caller);

  DELETE FROM public.match_players
  WHERE match_id = p_match_id AND user_id = v_caller;

  SELECT COUNT(*) INTO v_remaining
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_remaining = 0 THEN
    UPDATE public.matches
    SET status = 'cancelled', current_players = 0, seeking_player = false
    WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'cancelled', true, 'remaining', 0);
  END IF;

  v_new_creator := v_creator_id;

  IF v_was_creator THEN
    SELECT mp.user_id
    INTO v_new_creator
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
    ORDER BY mp.user_id
    LIMIT 1;

    UPDATE public.matches
    SET creator_id = v_new_creator,
        status = 'open',
        current_players = v_remaining,
        seeking_player = false
    WHERE id = p_match_id;

    RETURN jsonb_build_object(
      'success', true,
      'cancelled', false,
      'remaining', v_remaining,
      'creator_transferred', true,
      'new_creator_id', v_new_creator
    );
  END IF;

  UPDATE public.matches
  SET status = 'open', current_players = v_remaining
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled', false,
    'remaining', v_remaining,
    'creator_transferred', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_match(uuid, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, int, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.leave_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_match(uuid) TO authenticated;

-- Bloker direkte klient-inserts — alle tilmeldinger via RPC.
DROP POLICY IF EXISTS "Brugere kan tilmelde sig selv" ON public.match_players;
DROP POLICY IF EXISTS match_players_insert_via_rpc_only ON public.match_players;
CREATE POLICY match_players_insert_via_rpc_only
  ON public.match_players
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
