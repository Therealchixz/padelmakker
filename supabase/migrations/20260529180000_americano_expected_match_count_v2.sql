-- Americano: forventet antal kampe matcher ny round-robin planlægger (4–16 spillere, baner).
-- Bevar bagudkompatibilitet med gammel formel (5–8 spillere, n * passes).

CREATE OR REPLACE FUNCTION public.americano_round_robin_base_rounds(
  p_participants integer,
  p_courts_per_round integer DEFAULT 1
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    CASE
      WHEN p_participants % 2 = 0 THEN p_participants - 1
      ELSE p_participants
    END,
    CEIL(
      (p_participants * (p_participants - 1) / 2)::numeric
      / (2 * GREATEST(1, LEAST(GREATEST(COALESCE(p_courts_per_round, 1), 1), GREATEST(p_participants / 4, 1))))
    )::integer,
    CEIL(
      (p_participants * (p_participants - 1) / 2)::numeric
      / (4 * GREATEST(1, LEAST(GREATEST(COALESCE(p_courts_per_round, 1), 1), GREATEST(p_participants / 4, 1))))
    )::integer
  );
$$;

COMMENT ON FUNCTION public.americano_round_robin_base_rounds(integer, integer) IS
  'Minimum runder (Normal) for Americano — samme formel som appens americanoBaseRounds (før greedy-udvidelse).';

CREATE OR REPLACE FUNCTION public.expected_americano_match_count_legacy(
  p_participants integer,
  p_opponent_passes integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_passes integer;
BEGIN
  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;

  IF p_participants = 8 AND v_passes = 1 THEN
    RETURN 14;
  ELSIF p_participants = 8 AND v_passes = 2 THEN
    RETURN 28;
  ELSIF p_participants BETWEEN 5 AND 7 THEN
    RETURN p_participants * v_passes;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.expected_americano_match_count(
  p_participants integer,
  p_opponent_passes integer,
  p_courts_per_round integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_passes integer;
  v_base integer;
BEGIN
  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;
  v_base := public.americano_round_robin_base_rounds(p_participants, p_courts_per_round);
  RETURN v_base * v_passes;
END;
$$;

CREATE OR REPLACE FUNCTION public.americano_match_count_is_valid(
  p_participants integer,
  p_opponent_passes integer,
  p_courts_per_round integer,
  p_actual_matches integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_passes integer;
  v_base integer;
  v_min integer;
  v_max integer;
  v_legacy integer;
BEGIN
  IF p_actual_matches IS NULL OR p_actual_matches < 1 THEN
    RETURN false;
  END IF;

  v_passes := CASE WHEN COALESCE(p_opponent_passes, 1) = 2 THEN 2 ELSE 1 END;
  v_base := public.americano_round_robin_base_rounds(p_participants, p_courts_per_round);
  v_min := v_base * v_passes;
  -- App may extend up to base + n*4 runder per pass (fuld makker/modstander-dækning)
  v_max := (v_base + p_participants * 4) * v_passes;

  IF p_actual_matches >= v_min AND p_actual_matches <= v_max THEN
    RETURN true;
  END IF;

  v_legacy := public.expected_americano_match_count_legacy(p_participants, p_opponent_passes);
  IF v_legacy IS NOT NULL AND p_actual_matches = v_legacy THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_americano_complete_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_participants integer := 0;
  v_distinct_participants integer := 0;
  v_matches integer := 0;
  v_invalid_scores integer := 0;
  v_invalid_player_links integer := 0;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' THEN
    SELECT
      COUNT(*)::int,
      COUNT(DISTINCT ap.user_id)::int
    INTO v_participants, v_distinct_participants
    FROM public.americano_participants ap
    WHERE ap.tournament_id = NEW.id;

    IF v_participants < 4 OR v_participants > 16 THEN
      RAISE EXCEPTION 'Americano kraever mellem 4 og 16 deltagere ved afslutning (fandt %).', v_participants;
    END IF;

    IF v_distinct_participants <> v_participants THEN
      RAISE EXCEPTION 'Americano har duplikerede brugere i deltagerlisten (% unikke af %).', v_distinct_participants, v_participants;
    END IF;

    SELECT COUNT(*)::int
    INTO v_matches
    FROM public.americano_matches m
    WHERE m.tournament_id = NEW.id;

    IF NOT public.americano_match_count_is_valid(
      v_participants,
      NEW.opponent_passes,
      COALESCE(NEW.courts_per_round, 1),
      v_matches
    ) THEN
      RAISE EXCEPTION
        'Forkert antal Americano-kampe ved afslutning. Forventet ca. %–% (eller legacy %), fandt % (deltagere: %, baner: %, passes: %).',
        public.americano_round_robin_base_rounds(v_participants, COALESCE(NEW.courts_per_round, 1))
          * CASE WHEN COALESCE(NEW.opponent_passes, 1) = 2 THEN 2 ELSE 1 END,
        (public.americano_round_robin_base_rounds(v_participants, COALESCE(NEW.courts_per_round, 1)) + v_participants * 4)
          * CASE WHEN COALESCE(NEW.opponent_passes, 1) = 2 THEN 2 ELSE 1 END,
        COALESCE(public.expected_americano_match_count_legacy(v_participants, NEW.opponent_passes), -1),
        COALESCE(v_matches, 0),
        v_participants,
        COALESCE(NEW.courts_per_round, 1),
        COALESCE(NEW.opponent_passes, 1);
    END IF;

    SELECT COUNT(*)::int
    INTO v_invalid_scores
    FROM public.americano_matches m
    WHERE m.tournament_id = NEW.id
      AND (
        m.team_a_score IS NULL
        OR m.team_b_score IS NULL
        OR (m.team_a_score + m.team_b_score) <> NEW.points_per_match
      );

    IF v_invalid_scores > 0 THEN
      RAISE EXCEPTION
        'Americano kan ikke afsluttes: % kamp(e) har ugyldig score ift. points_per_match=%.',
        v_invalid_scores,
        COALESCE(NEW.points_per_match, 0);
    END IF;

    SELECT COUNT(*)::int
    INTO v_invalid_player_links
    FROM public.americano_matches m
    LEFT JOIN public.americano_participants a1 ON a1.id = m.team_a_p1 AND a1.tournament_id = m.tournament_id
    LEFT JOIN public.americano_participants a2 ON a2.id = m.team_a_p2 AND a2.tournament_id = m.tournament_id
    LEFT JOIN public.americano_participants b1 ON b1.id = m.team_b_p1 AND b1.tournament_id = m.tournament_id
    LEFT JOIN public.americano_participants b2 ON b2.id = m.team_b_p2 AND b2.tournament_id = m.tournament_id
    WHERE m.tournament_id = NEW.id
      AND (
        a1.id IS NULL OR a2.id IS NULL OR b1.id IS NULL OR b2.id IS NULL
      );

    IF v_invalid_player_links > 0 THEN
      RAISE EXCEPTION
        'Americano kan ikke afsluttes: % kamp(e) refererer til ugyldige deltagere.',
        v_invalid_player_links;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
