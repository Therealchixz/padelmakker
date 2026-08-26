-- Valgfri p_court_side ved tilmelding, så spilleren kan vælge venstre/højre.

DROP FUNCTION IF EXISTS public.join_open_match(uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS public.join_open_match(uuid, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.join_open_match(
  p_match_id uuid,
  p_team int DEFAULT NULL,
  p_user_name text DEFAULT NULL,
  p_user_email text DEFAULT NULL,
  p_user_emoji text DEFAULT '🎾',
  p_court_side text DEFAULT NULL
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
  v_pref text;
  v_wanted text;
  v_side text;
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

  SELECT CASE
    WHEN lower(coalesce(p.court_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p.court_side, '')) LIKE '%højre%'
      OR lower(coalesce(p.court_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END
  INTO v_pref
  FROM public.profiles p
  WHERE p.id = v_caller;

  v_wanted := CASE
    WHEN p_court_side IN ('left', 'right') THEN p_court_side
    WHEN lower(coalesce(p_court_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p_court_side, '')) LIKE '%højre%'
      OR lower(coalesce(p_court_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END;

  v_side := public.match_players_free_court_side(
    p_match_id,
    v_team,
    NULL,
    coalesce(v_wanted, v_pref)
  );

  BEGIN
    INSERT INTO public.match_players (match_id, user_id, user_name, user_email, user_emoji, team, court_side)
    VALUES (
      p_match_id,
      v_caller,
      coalesce(v_name, 'Spiller'),
      nullif(btrim(coalesce(p_user_email, '')), ''),
      coalesce(nullif(btrim(p_user_emoji), ''), '🎾'),
      v_team,
      v_side
    )
    ON CONFLICT ON CONSTRAINT match_players_match_id_user_id_key DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      IF EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
      ) THEN
        RETURN jsonb_build_object('success', true, 'already_joined', true, 'team', v_team);
      END IF;
      RETURN jsonb_build_object('success', false, 'error', 'insert_failed');
  END;

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
    'court_side', v_side,
    'is_full', (v_t1 >= 2 AND v_t2 >= 2),
    'current_players', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_match(uuid, int, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, int, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
