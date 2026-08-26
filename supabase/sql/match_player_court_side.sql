-- Venstre/højre-side på 2v2-kampe (match_players.court_side).
-- Auto-udfylde ved tilmelding; spillere/opretter kan bytte via RPC.

ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS court_side text;

ALTER TABLE public.match_players
  DROP CONSTRAINT IF EXISTS match_players_court_side_check;

ALTER TABLE public.match_players
  ADD CONSTRAINT match_players_court_side_check
  CHECK (court_side IS NULL OR court_side IN ('left', 'right'));

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY match_id, team
      ORDER BY joined_at NULLS LAST, id
    ) AS rn
  FROM public.match_players
  WHERE team IN (1, 2)
    AND court_side IS NULL
)
UPDATE public.match_players mp
SET court_side = CASE WHEN r.rn = 1 THEN 'left' WHEN r.rn = 2 THEN 'right' ELSE NULL END
FROM ranked r
WHERE mp.id = r.id;

ALTER TABLE public.match_players
  DROP CONSTRAINT IF EXISTS match_players_unique_team_side;

ALTER TABLE public.match_players
  ADD CONSTRAINT match_players_unique_team_side
  UNIQUE (match_id, team, court_side)
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION public.match_players_fill_court_side()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_has_left boolean;
  v_has_right boolean;
  v_pref text;
BEGIN
  IF NEW.team IS NULL OR NEW.team NOT IN (1, 2) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.team IS DISTINCT FROM OLD.team
     AND NEW.court_side IS NOT DISTINCT FROM OLD.court_side THEN
    NEW.court_side := NULL;
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = NEW.match_id
        AND mp.team = NEW.team
        AND mp.court_side = 'left'
        AND mp.id IS DISTINCT FROM NEW.id
    ),
    EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = NEW.match_id
        AND mp.team = NEW.team
        AND mp.court_side = 'right'
        AND mp.id IS DISTINCT FROM NEW.id
    )
  INTO v_has_left, v_has_right;

  IF NEW.court_side IN ('left', 'right') THEN
    RETURN NEW;
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

  IF v_pref = 'left' AND NOT v_has_left THEN
    NEW.court_side := 'left';
  ELSIF v_pref = 'right' AND NOT v_has_right THEN
    NEW.court_side := 'right';
  ELSIF NOT v_has_left THEN
    NEW.court_side := 'left';
  ELSE
    NEW.court_side := 'right';
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
  v_other_side text;
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

  SELECT mp.user_id, mp.court_side
  INTO v_other, v_other_side
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.team = v_team
    AND mp.user_id <> p_user_id
    AND mp.court_side = v_side
  LIMIT 1;

  SET CONSTRAINTS match_players_unique_team_side DEFERRED;

  IF v_other IS NOT NULL THEN
    UPDATE public.match_players
    SET court_side = coalesce(v_current, CASE WHEN v_side = 'left' THEN 'right' ELSE 'left' END)
    WHERE match_id = p_match_id
      AND user_id = v_other;

    UPDATE public.match_players
    SET court_side = v_side
    WHERE match_id = p_match_id
      AND user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'court_side', v_side,
      'swapped_user_id', v_other
    );
  END IF;

  UPDATE public.match_players
  SET court_side = v_side
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'court_side', v_side);
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_player_court_side(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_player_court_side(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_match_player_team(
  p_match_id uuid,
  p_user_id uuid,
  p_team int
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
  v_current_team int;
  v_t1 int;
  v_t2 int;
  v_target_count int;
  v_total int;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_team NOT IN (1, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_team');
  END IF;

  SELECT m.creator_id, lower(coalesce(m.status, 'open'))
  INTO v_creator_id, v_status
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  IF v_status NOT IN ('open', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_open');
  END IF;

  IF p_user_id <> v_caller
     AND v_creator_id <> v_caller
     AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT mp.team
  INTO v_current_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_in_match');
  END IF;

  IF v_current_team = p_team THEN
    RETURN jsonb_build_object('success', true, 'team', p_team, 'unchanged', true);
  END IF;

  SELECT COUNT(*)
  INTO v_target_count
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.team = p_team;

  IF v_target_count >= 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', p_team);
  END IF;

  UPDATE public.match_players
  SET team = p_team,
      court_side = NULL
  WHERE match_id = p_match_id
    AND user_id = p_user_id;

  SELECT
    COUNT(*) FILTER (WHERE team = 1),
    COUNT(*) FILTER (WHERE team = 2),
    COUNT(*)
  INTO v_t1, v_t2, v_total
  FROM public.match_players
  WHERE match_id = p_match_id;

  IF v_t1 > 2 OR v_t2 > 2 THEN
    UPDATE public.match_players
    SET team = v_current_team,
        court_side = NULL
    WHERE match_id = p_match_id
      AND user_id = p_user_id;
    RETURN jsonb_build_object('success', false, 'error', 'team_full', 'team', p_team);
  END IF;

  IF v_t1 >= 2 AND v_t2 >= 2 THEN
    UPDATE public.matches
    SET status = 'full',
        current_players = v_total,
        seeking_player = false
    WHERE id = p_match_id;
  ELSE
    UPDATE public.matches
    SET status = 'open',
        current_players = v_total
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'team', p_team);
END;
$$;

REVOKE ALL ON FUNCTION public.set_match_player_team(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_match_player_team(uuid, uuid, int) TO authenticated;

GRANT SELECT (
  id, match_id, user_id, user_name, user_emoji, joined_at, team, court_side
) ON public.match_players TO authenticated;

NOTIFY pgrst, 'reload schema';
