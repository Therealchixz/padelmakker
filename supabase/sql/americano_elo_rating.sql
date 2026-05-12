-- =============================================================================
-- Americano: separat ELO-system (adskilt fra normal 2v2 ELO)
-- - Gemmer rating i profiles.americano_elo_rating
-- - Logger ændringer pr. turnering i americano_elo_history
-- - Beregner multiplayer-ELO ud fra slutstilling (sum af kamp-point)
-- - Dynamisk K for mere action tidligt:
--     americano_played 0-4  -> K=72
--     americano_played 5-19 -> K=56
--     americano_played 20+  -> K=40
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS americano_elo_rating integer NOT NULL DEFAULT 1000;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS americano_played integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.americano_elo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.americano_tournaments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  old_rating integer NOT NULL,
  new_rating integer NOT NULL,
  change integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  placement integer NOT NULL,
  participant_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_americano_elo_history_tournament ON public.americano_elo_history (tournament_id);
CREATE INDEX IF NOT EXISTS idx_americano_elo_history_user_created ON public.americano_elo_history (user_id, created_at DESC);

ALTER TABLE public.americano_elo_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS americano_elo_history_select_authenticated ON public.americano_elo_history;
CREATE POLICY americano_elo_history_select_authenticated ON public.americano_elo_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS americano_elo_history_insert_deny ON public.americano_elo_history;
CREATE POLICY americano_elo_history_insert_deny ON public.americano_elo_history
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS americano_elo_history_update_deny ON public.americano_elo_history;
CREATE POLICY americano_elo_history_update_deny ON public.americano_elo_history
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS americano_elo_history_delete_deny ON public.americano_elo_history;
CREATE POLICY americano_elo_history_delete_deny ON public.americano_elo_history
  FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.apply_americano_elo_for_tournament(p_tournament_id uuid)
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
  v_points_per_match integer;
  v_total_matches integer := 0;
  v_valid_matches integer := 0;
  v_player_count integer := 0;
  v_players_updated integer := 0;
  v_total_change integer := 0;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF p_tournament_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler tournament_id');
  END IF;

  SELECT t.creator_id, t.status, t.points_per_match
    INTO v_creator_id, v_status, v_points_per_match
  FROM public.americano_tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Turnering ikke fundet');
  END IF;

  SELECT p.role
    INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  IF v_actor_id <> v_creator_id AND COALESCE(v_actor_role, '') <> 'admin' THEN
    RETURN jsonb_build_object('error', 'Kun opretter eller admin må beregne Americano-ELO');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.americano_elo_history h
    WHERE h.tournament_id = p_tournament_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_applied', true,
      'players_updated', (
        SELECT COUNT(*)::int FROM public.americano_elo_history h
        WHERE h.tournament_id = p_tournament_id
      )
    );
  END IF;

  IF v_status <> 'completed' THEN
    RETURN jsonb_build_object('error', 'Turneringen skal være afsluttet før Americano-ELO kan beregnes');
  END IF;

  SELECT COUNT(*)::int
    INTO v_total_matches
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id;

  IF COALESCE(v_total_matches, 0) = 0 THEN
    RETURN jsonb_build_object('error', 'Turneringen har ingen kampe');
  END IF;

  SELECT COUNT(*)::int
    INTO v_valid_matches
  FROM public.americano_matches m
  WHERE m.tournament_id = p_tournament_id
    AND m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND (m.team_a_score + m.team_b_score) = v_points_per_match;

  IF COALESCE(v_valid_matches, 0) <> COALESCE(v_total_matches, 0) THEN
    RETURN jsonb_build_object(
      'error',
      format(
        'Alle kampe skal være udfyldt korrekt før ELO-beregning (%s/%s gyldige).',
        COALESCE(v_valid_matches, 0),
        COALESCE(v_total_matches, 0)
      )
    );
  END IF;

  WITH participant_points AS (
    SELECT
      ap.id AS participant_id,
      ap.user_id,
      COALESCE(SUM(
        CASE
          WHEN ap.id IN (m.team_a_p1, m.team_a_p2) THEN COALESCE(m.team_a_score, 0)
          WHEN ap.id IN (m.team_b_p1, m.team_b_p2) THEN COALESCE(m.team_b_score, 0)
          ELSE 0
        END
      ), 0)::int AS points
    FROM public.americano_participants ap
    LEFT JOIN public.americano_matches m
      ON m.tournament_id = ap.tournament_id
    WHERE ap.tournament_id = p_tournament_id
    GROUP BY ap.id, ap.user_id
  ),
  rated AS (
    SELECT
      pp.participant_id,
      pp.user_id,
      pp.points,
      COALESCE(pr.americano_elo_rating, 1000)::int AS old_rating,
      COALESCE((
        SELECT COUNT(*)::int
        FROM public.americano_elo_history h
        WHERE h.user_id = pp.user_id
      ), 0)::int AS americano_played
    FROM participant_points pp
    JOIN public.profiles pr
      ON pr.id = pp.user_id
  ),
  pairwise AS (
    SELECT
      a.user_id,
      a.participant_id,
      a.points,
      a.old_rating,
      a.americano_played,
      SUM(
        CASE
          WHEN a.points > b.points THEN 1::numeric
          WHEN a.points = b.points THEN 0.5::numeric
          ELSE 0::numeric
        END
      ) AS actual_sum,
      SUM(
        1::numeric / (1::numeric + power(10::numeric, (b.old_rating - a.old_rating)::numeric / 400::numeric))
      ) AS expected_sum
    FROM rated a
    JOIN rated b
      ON b.user_id <> a.user_id
    GROUP BY a.user_id, a.participant_id, a.points, a.old_rating, a.americano_played
  ),
  deltas_raw AS (
    SELECT
      p.*,
      COUNT(*) OVER ()::int AS participant_count,
      CASE
        WHEN COALESCE(p.americano_played, 0) < 5 THEN 72::numeric
        WHEN COALESCE(p.americano_played, 0) < 20 THEN 56::numeric
        ELSE 40::numeric
      END AS k_value,
      (
        (
          CASE
            WHEN COALESCE(p.americano_played, 0) < 5 THEN 72::numeric
            WHEN COALESCE(p.americano_played, 0) < 20 THEN 56::numeric
            ELSE 40::numeric
          END
        ) * (p.actual_sum - p.expected_sum) / GREATEST(1, COUNT(*) OVER () - 1)::numeric
      ) AS delta_raw
    FROM pairwise p
  ),
  deltas_centered AS (
    SELECT
      d.*,
      (d.delta_raw - AVG(d.delta_raw) OVER ()) AS delta_raw_centered
    FROM deltas_raw d
  ),
  rounded AS (
    SELECT
      d.*,
      round(d.delta_raw_centered)::int AS delta_rounded
    FROM deltas_centered d
  ),
  rounded_total AS (
    SELECT COALESCE(SUM(delta_rounded), 0)::int AS total_delta
    FROM rounded
  ),
  correction_rank AS (
    SELECT
      r.*,
      (r.delta_rounded::numeric - r.delta_raw_centered) AS rounding_residual,
      rt.total_delta,
      CASE
        WHEN rt.total_delta > 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_raw_centered) DESC, r.delta_rounded DESC, r.user_id
        )
        WHEN rt.total_delta < 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_raw_centered) ASC, r.delta_rounded ASC, r.user_id
        )
        ELSE 0
      END AS correction_order
    FROM rounded r
    CROSS JOIN rounded_total rt
  ),
  final_deltas AS (
    SELECT
      c.user_id,
      c.participant_id,
      c.points,
      c.old_rating,
      c.americano_played,
      c.participant_count,
      (
        c.delta_rounded
        + CASE
            WHEN c.total_delta > 0 AND c.correction_order <= c.total_delta THEN -1
            WHEN c.total_delta < 0 AND c.correction_order <= abs(c.total_delta) THEN 1
            ELSE 0
          END
      )::int AS delta
    FROM correction_rank c
  ),
  ranked AS (
    SELECT
      f.*,
      dense_rank() OVER (ORDER BY f.points DESC) AS placement
    FROM final_deltas f
  ),
  capped AS (
    SELECT
      r.*,
      (100 - r.old_rating)::int AS min_delta,
      GREATEST(r.delta, (100 - r.old_rating))::int AS delta_capped
    FROM ranked r
  ),
  cap_totals AS (
    SELECT
      COALESCE(SUM(delta_capped - delta), 0)::int AS overflow_total
    FROM capped
  ),
  cap_order AS (
    SELECT
      c.*,
      GREATEST(c.delta_capped - c.min_delta, 0)::int AS give_back_capacity,
      row_number() OVER (ORDER BY c.delta_capped DESC, c.user_id) AS cap_order
    FROM capped c
  ),
  cap_alloc AS (
    SELECT
      co.*,
      ct.overflow_total,
      COALESCE(
        SUM(co.give_back_capacity) OVER (
          ORDER BY co.cap_order
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
      )::int AS capacity_before
    FROM cap_order co
    CROSS JOIN cap_totals ct
  ),
  final_applied AS (
    SELECT
      ca.user_id,
      ca.participant_id,
      ca.points,
      ca.old_rating,
      ca.americano_played,
      ca.participant_count,
      ca.placement,
      (
        ca.delta_capped
        - LEAST(
            ca.give_back_capacity,
            GREATEST(ca.overflow_total - ca.capacity_before, 0)
          )
      )::int AS delta
    FROM cap_alloc ca
  ),
  updated_profiles AS (
    UPDATE public.profiles p
    SET
      americano_elo_rating = GREATEST(100, COALESCE(p.americano_elo_rating, 1000) + r.delta),
      americano_played = GREATEST(COALESCE(p.americano_played, 0), COALESCE(r.americano_played, 0) + 1)
    FROM final_applied r
    WHERE p.id = r.user_id
    RETURNING p.id, p.americano_elo_rating, p.americano_played
  ),
  inserted_history AS (
    INSERT INTO public.americano_elo_history (
      tournament_id,
      user_id,
      old_rating,
      new_rating,
      change,
      points,
      placement,
      participant_count
    )
    SELECT
      p_tournament_id,
      r.user_id,
      r.old_rating,
      GREATEST(100, r.old_rating + r.delta),
      r.delta,
      r.points,
      r.placement,
      r.participant_count
    FROM final_applied r
    RETURNING id, user_id, change
  )
  SELECT
    COALESCE((SELECT COUNT(*)::int FROM inserted_history), 0),
    COALESCE((SELECT SUM(change)::int FROM inserted_history), 0),
    COALESCE((SELECT MAX(participant_count) FROM ranked), 0)
  INTO v_players_updated, v_total_change, v_player_count;

  RETURN jsonb_build_object(
    'success', true,
    'players_updated', COALESCE(v_players_updated, 0),
    'participant_count', COALESCE(v_player_count, 0),
    'total_change', COALESCE(v_total_change, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_americano_elo_for_tournament(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_americano_elo_for_tournament(uuid) TO authenticated;

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
    SET status = 'completed',
        updated_at = now()
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
