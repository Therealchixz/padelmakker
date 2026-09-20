-- Fix: tilmelding ramte unik-begrænsningen på (hold, side) og viste
-- "Det findes allerede". Triggeren må ikke give to spillere samme side,
-- og ON CONFLICT skal kun ramme (match, user) — ikke den deferrable side-nøgle.

CREATE OR REPLACE FUNCTION public.match_players_free_court_side(
  p_match_id uuid,
  p_team int,
  p_exclude_id uuid,
  p_preferred text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_has_left boolean;
  v_has_right boolean;
  v_pref text;
BEGIN
  v_pref := CASE
    WHEN p_preferred IN ('left', 'right') THEN p_preferred
    ELSE NULL
  END;

  SELECT
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id
        AND mp.team = p_team
        AND mp.court_side = 'left'
        AND mp.id IS DISTINCT FROM p_exclude_id
    ),
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id
        AND mp.team = p_team
        AND mp.court_side = 'right'
        AND mp.id IS DISTINCT FROM p_exclude_id
    )
  INTO v_has_left, v_has_right;

  IF v_pref = 'left' AND NOT v_has_left THEN RETURN 'left'; END IF;
  IF v_pref = 'right' AND NOT v_has_right THEN RETURN 'right'; END IF;
  IF NOT v_has_left THEN RETURN 'left'; END IF;
  IF NOT v_has_right THEN RETURN 'right'; END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.match_players_free_court_side(uuid, int, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.match_players_fill_court_side()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_pref text;
  v_free text;
BEGIN
  IF NEW.team IS NULL OR NEW.team NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.team IS DISTINCT FROM OLD.team
     AND NEW.court_side IS NOT DISTINCT FROM OLD.court_side THEN
    NEW.court_side := NULL;
  END IF;

  SELECT CASE
    WHEN lower(coalesce(p.court_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p.court_side, '')) LIKE '%højre%'
      OR lower(coalesce(p.court_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END
  INTO v_pref
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF NEW.court_side IN ('left', 'right') THEN
    v_free := public.match_players_free_court_side(NEW.match_id, NEW.team, NEW.id, NEW.court_side);
    IF v_free IS NULL THEN
      NEW.court_side := NULL;
    ELSIF v_free <> NEW.court_side THEN
      NEW.court_side := v_free;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.team IS DISTINCT FROM OLD.team) THEN
    NEW.court_side := public.match_players_free_court_side(NEW.match_id, NEW.team, NEW.id, v_pref);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_players_fill_court_side ON public.match_players;
CREATE TRIGGER match_players_fill_court_side
  BEFORE INSERT OR UPDATE OF team, court_side, user_id
  ON public.match_players
  FOR EACH ROW
  EXECUTE FUNCTION public.match_players_fill_court_side();

ALTER TABLE public.match_players
  DROP CONSTRAINT IF EXISTS match_players_unique_team_side;

DROP INDEX IF EXISTS public.match_players_unique_team_side;

CREATE UNIQUE INDEX match_players_unique_team_side
  ON public.match_players (match_id, team, court_side)
  WHERE court_side IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_match_player_court_side(
  p_match_id uuid,
  p_user_id uuid,
  p_side text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_creator_id uuid;
  v_status text;
  v_team int;
  v_current text;
  v_side text;
  v_other uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_side := CASE
    WHEN p_side IN ('left', 'right') THEN p_side
    WHEN lower(coalesce(p_side, '')) LIKE '%venstre%' THEN 'left'
    WHEN lower(coalesce(p_side, '')) LIKE '%højre%'
      OR lower(coalesce(p_side, '')) LIKE '%hojre%' THEN 'right'
    ELSE NULL
  END;

  IF v_side IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_side');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status NOT IN ('open', 'full', 'in_progress') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  IF p_user_id <> v_caller
     AND v_creator_id <> v_caller
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT mp.team, mp.court_side
  INTO v_team, v_current
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_in_match');
  END IF;

  IF v_current = v_side THEN
    RETURN jsonb_build_object('success', true, 'court_side', v_side, 'unchanged', true);
  END IF;

  SELECT mp.user_id
  INTO v_other
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.team = v_team
    AND mp.user_id <> p_user_id
    AND mp.court_side = v_side
  LIMIT 1;

  UPDATE public.match_players
  SET court_side = NULL
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  IF v_other IS NOT NULL THEN
    UPDATE public.match_players
    SET court_side = coalesce(v_current, CASE WHEN v_side = 'left' THEN 'right' ELSE 'left' END)
    WHERE match_id = p_match_id
      AND user_id = v_other;
  END IF;

  UPDATE public.match_players
  SET court_side = v_side
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'court_side', v_side,
    'swapped_user_id', v_other
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_player_court_side(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_player_court_side(uuid, uuid, text) TO authenticated;

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
  v_pref text;
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

  v_side := public.match_players_free_court_side(p_match_id, v_team, NULL, v_pref);

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
    'is_full', (v_t1 >= 2 AND v_t2 >= 2),
    'current_players', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_match(uuid, int, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, int, text, text, text) TO authenticated;
