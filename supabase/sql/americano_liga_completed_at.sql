-- =============================================================================
-- Americano + Liga: faktisk afslutningstid til 24t "Indberet fejl"
-- Kør i Supabase → SQL Editor (efter feature_result_error_reports.sql)
-- =============================================================================

ALTER TABLE public.americano_tournaments
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_americano_tournaments_completed_at
  ON public.americano_tournaments (completed_at)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_leagues_completed_at
  ON public.leagues (completed_at)
  WHERE status = 'completed';

-- ── Helper: Americano afslutningstid ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._americano_entity_finished_at(p_tournament_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed timestamptz;
  v_created timestamptz;
  v_updated timestamptz;
  v_date date;
  v_time_slot text;
  v_ts timestamptz;
BEGIN
  SELECT t.completed_at, t.created_at, t.updated_at, t.tournament_date, t.time_slot
    INTO v_completed, v_created, v_updated, v_date, v_time_slot
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_completed IS NOT NULL AND (v_created IS NULL OR v_completed > v_created + interval '1 minute') THEN
    RETURN v_completed;
  END IF;

  IF to_regclass('public.americano_elo_history') IS NOT NULL THEN
    SELECT max(h.created_at)
      INTO v_ts
    FROM public.americano_elo_history h
    WHERE h.tournament_id = p_tournament_id;

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;
  END IF;

  SELECT max(m.updated_at)
    INTO v_ts
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id
    AND m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL;

  IF v_ts IS NOT NULL THEN
    RETURN v_ts;
  END IF;

  IF v_updated IS NOT NULL AND (v_created IS NULL OR v_updated > v_created + interval '1 minute') THEN
    RETURN v_updated;
  END IF;

  IF v_date IS NOT NULL THEN
    RETURN (v_date::text || ' ' || coalesce(nullif(trim(v_time_slot), ''), '18:00'))::timestamptz;
  END IF;

  RETURN v_created;
END;
$$;

-- ── Helper: Liga afslutningstid ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._league_entity_finished_at(p_league_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed timestamptz;
  v_created timestamptz;
  v_updated timestamptz;
  v_end_date date;
  v_ts timestamptz;
BEGIN
  SELECT l.completed_at, l.created_at, l.updated_at, l.end_date
    INTO v_completed, v_created, v_updated, v_end_date
  FROM public.leagues l
  WHERE l.id = p_league_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_completed IS NOT NULL AND (v_created IS NULL OR v_completed > v_created + interval '1 minute') THEN
    RETURN v_completed;
  END IF;

  IF to_regclass('public.league_matches') IS NOT NULL THEN
    SELECT max(lm.created_at)
      INTO v_ts
    FROM public.league_matches lm
    WHERE lm.league_id = p_league_id
      AND lm.status = 'reported';

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;
  END IF;

  IF v_updated IS NOT NULL AND (v_created IS NULL OR v_updated > v_created + interval '1 minute') THEN
    RETURN v_updated;
  END IF;

  IF v_end_date IS NOT NULL THEN
    RETURN v_end_date::timestamptz;
  END IF;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public._americano_entity_finished_at(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._league_entity_finished_at(uuid) FROM PUBLIC;

-- ── Opdater fejlindberetning-helper (UI + RPC bruger samme logik) ────────────

CREATE OR REPLACE FUNCTION public._result_error_entity_completed_at(
  p_source_type text,
  p_entity_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz;
  v_created timestamptz;
BEGIN
  IF p_source_type = 'match_2v2' THEN
    SELECT m.completed_at, m.created_at
      INTO v_ts, v_created
    FROM public.matches m
    WHERE m.id = p_entity_id;

    IF v_ts IS NOT NULL AND (v_created IS NULL OR v_ts > v_created + interval '1 minute') THEN
      RETURN v_ts;
    END IF;

    SELECT max(mr.created_at)
      INTO v_ts
    FROM public.match_results mr
    WHERE mr.match_id = p_entity_id
      AND mr.confirmed = true;

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;

    SELECT (m.date::text || ' ' || coalesce(nullif(trim(m.time::text), ''), '12:00'))::timestamptz
      INTO v_ts
    FROM public.matches m
    WHERE m.id = p_entity_id AND m.date IS NOT NULL;

    RETURN v_ts;
  ELSIF p_source_type = 'americano' THEN
    RETURN public._americano_entity_finished_at(p_entity_id);
  ELSIF p_source_type = 'league' THEN
    RETURN public._league_entity_finished_at(p_entity_id);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._result_error_entity_completed_at(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._result_error_entity_completed_at(text, uuid) TO authenticated;

-- ── Sæt completed_at ved afslutning (bevar første tidspunkt) ─────────────────

CREATE OR REPLACE FUNCTION public.complete_americano_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role text;
  v_creator_id uuid;
  v_status text;
  v_apply jsonb;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Mangler tournament_id';
  END IF;

  SELECT t.creator_id, t.status
    INTO v_creator_id, v_status
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turnering ikke fundet';
  END IF;

  SELECT p.role
    INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF v_actor_id <> v_creator_id AND COALESCE(v_actor_role, '') <> 'admin' THEN
    RAISE EXCEPTION 'Kun opretter eller admin må afslutte turneringen';
  END IF;

  IF v_status <> 'completed' THEN
    UPDATE public.americano_tournaments
    SET
      status = 'completed',
      updated_at = now(),
      completed_at = coalesce(completed_at, now())
    WHERE id = p_tournament_id;
  END IF;

  v_apply := public.apply_americano_elo_for_tournament(p_tournament_id);

  IF v_apply ? 'error' THEN
    RAISE EXCEPTION '%', COALESCE(v_apply->>'error', 'Ukendt Americano-ELO fejl');
  END IF;

  RETURN v_apply || jsonb_build_object(
    'success', true,
    'status_updated', (v_status <> 'completed')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_americano_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_americano_tournament(uuid) TO authenticated;

-- ── Backfill eksisterende afsluttede rækker ───────────────────────────────────

UPDATE public.americano_tournaments t
SET completed_at = sub.finished_at
FROM (
  SELECT
    t2.id,
    public._americano_entity_finished_at(t2.id) AS finished_at
  FROM public.americano_tournaments t2
  WHERE t2.status = 'completed'
) sub
WHERE t.id = sub.id
  AND t.completed_at IS NULL
  AND sub.finished_at IS NOT NULL;

UPDATE public.leagues l
SET completed_at = sub.finished_at
FROM (
  SELECT
    l2.id,
    public._league_entity_finished_at(l2.id) AS finished_at
  FROM public.leagues l2
  WHERE l2.status = 'completed'
) sub
WHERE l.id = sub.id
  AND l.completed_at IS NULL
  AND sub.finished_at IS NOT NULL;
