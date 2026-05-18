-- =============================================================================
-- ELO v2 + Glicko-2 shadow (2v2)
--
-- Run this whole file in Supabase SQL Editor.
--
-- What this script does:
--  1) Upgrades 2v2 ELO to per-player K + zero-sum correction.
--  2) Keeps your current visible ELO as official rating.
--  3) Adds a hidden Glicko-2 shadow model for A/B comparison.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Shadow tables (hidden model)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.glicko2_shadow_ratings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating numeric(10,4) NOT NULL DEFAULT 1500,
  rd numeric(10,4) NOT NULL DEFAULT 350,
  volatility numeric(10,6) NOT NULL DEFAULT 0.06,
  games_played integer NOT NULL DEFAULT 0,
  last_match_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.glicko2_shadow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_rating numeric(10,4) NOT NULL,
  new_rating numeric(10,4) NOT NULL,
  old_rd numeric(10,4) NOT NULL,
  new_rd numeric(10,4) NOT NULL,
  old_volatility numeric(10,6) NOT NULL,
  new_volatility numeric(10,6) NOT NULL,
  expected numeric(10,6) NOT NULL,
  outcome numeric(3,1) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_glicko2_shadow_history_user_created
  ON public.glicko2_shadow_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_glicko2_shadow_history_match
  ON public.glicko2_shadow_history (match_id);

ALTER TABLE public.glicko2_shadow_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glicko2_shadow_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS glicko2_shadow_ratings_select_auth ON public.glicko2_shadow_ratings;
CREATE POLICY glicko2_shadow_ratings_select_auth
  ON public.glicko2_shadow_ratings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS glicko2_shadow_ratings_insert_deny ON public.glicko2_shadow_ratings;
CREATE POLICY glicko2_shadow_ratings_insert_deny
  ON public.glicko2_shadow_ratings
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS glicko2_shadow_ratings_update_deny ON public.glicko2_shadow_ratings;
CREATE POLICY glicko2_shadow_ratings_update_deny
  ON public.glicko2_shadow_ratings
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS glicko2_shadow_ratings_delete_deny ON public.glicko2_shadow_ratings;
CREATE POLICY glicko2_shadow_ratings_delete_deny
  ON public.glicko2_shadow_ratings
  FOR DELETE TO authenticated
  USING (false);

DROP POLICY IF EXISTS glicko2_shadow_history_select_auth ON public.glicko2_shadow_history;
CREATE POLICY glicko2_shadow_history_select_auth
  ON public.glicko2_shadow_history
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS glicko2_shadow_history_insert_deny ON public.glicko2_shadow_history;
CREATE POLICY glicko2_shadow_history_insert_deny
  ON public.glicko2_shadow_history
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS glicko2_shadow_history_update_deny ON public.glicko2_shadow_history;
CREATE POLICY glicko2_shadow_history_update_deny
  ON public.glicko2_shadow_history
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS glicko2_shadow_history_delete_deny ON public.glicko2_shadow_history;
CREATE POLICY glicko2_shadow_history_delete_deny
  ON public.glicko2_shadow_history
  FOR DELETE TO authenticated
  USING (false);

-- -----------------------------------------------------------------------------
-- 1) Glicko-2 single-step updater (shadow)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.glicko2_shadow_update_one(
  p_rating numeric,
  p_rd numeric,
  p_volatility numeric,
  p_opp_rating numeric,
  p_opp_rd numeric,
  p_outcome numeric,
  p_tau numeric DEFAULT 0.5,
  p_epsilon numeric DEFAULT 0.000001
)
RETURNS TABLE (
  new_rating numeric,
  new_rd numeric,
  new_volatility numeric,
  expected numeric,
  delta_rating numeric
)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_scale constant numeric := 173.7178;

  v_mu numeric;
  v_phi numeric;
  v_sigma numeric;

  v_mu_j numeric;
  v_phi_j numeric;

  v_g numeric;
  v_e numeric;
  v_v numeric;
  v_delta numeric;

  v_a numeric;
  v_a_cur numeric;
  v_b_cur numeric;
  v_c_cur numeric;
  v_f_a numeric;
  v_f_b numeric;
  v_f_c numeric;
  v_exp_x numeric;
  v_k integer := 1;
  v_iter integer := 0;

  v_sigma_prime numeric;
  v_phi_star numeric;
  v_phi_prime numeric;
  v_mu_prime numeric;

  v_delta_sq numeric;
  v_phi_sq numeric;
BEGIN
  v_mu := (COALESCE(p_rating, 1500) - 1500) / v_scale;
  v_phi := GREATEST(COALESCE(p_rd, 350), 30) / v_scale;
  v_sigma := GREATEST(COALESCE(p_volatility, 0.06), 0.000001);

  v_mu_j := (COALESCE(p_opp_rating, 1500) - 1500) / v_scale;
  v_phi_j := GREATEST(COALESCE(p_opp_rd, 350), 30) / v_scale;

  v_g := 1 / sqrt(1 + (3 * power(v_phi_j, 2) / power(pi(), 2)));
  v_e := 1 / (1 + exp(-v_g * (v_mu - v_mu_j)));
  v_v := 1 / (power(v_g, 2) * v_e * (1 - v_e));
  v_delta := v_v * v_g * (COALESCE(p_outcome, 0) - v_e);

  v_a := ln(power(v_sigma, 2));
  v_delta_sq := power(v_delta, 2);
  v_phi_sq := power(v_phi, 2);

  v_a_cur := v_a;

  IF v_delta_sq > (v_phi_sq + v_v) THEN
    v_b_cur := ln(v_delta_sq - v_phi_sq - v_v);
  ELSE
    LOOP
      v_b_cur := v_a - v_k * COALESCE(p_tau, 0.5);
      v_exp_x := exp(v_b_cur);
      v_f_b := (
        v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
        / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
      ) - ((v_b_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

      EXIT WHEN v_f_b >= 0 OR v_k > 100;
      v_k := v_k + 1;
    END LOOP;
  END IF;

  v_exp_x := exp(v_a_cur);
  v_f_a := (
    v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
    / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
  ) - ((v_a_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

  v_exp_x := exp(v_b_cur);
  v_f_b := (
    v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
    / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
  ) - ((v_b_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

  WHILE abs(v_b_cur - v_a_cur) > COALESCE(p_epsilon, 0.000001) AND v_iter < 100 LOOP
    IF abs(v_f_b - v_f_a) < 0.000000000001 THEN
      v_c_cur := (v_a_cur + v_b_cur) / 2;
    ELSE
      v_c_cur := v_a_cur + (v_a_cur - v_b_cur) * v_f_a / (v_f_b - v_f_a);
    END IF;

    v_exp_x := exp(v_c_cur);
    v_f_c := (
      v_exp_x * (v_delta_sq - v_phi_sq - v_v - v_exp_x)
      / (2 * power(v_phi_sq + v_v + v_exp_x, 2))
    ) - ((v_c_cur - v_a) / power(COALESCE(p_tau, 0.5), 2));

    IF v_f_c * v_f_b <= 0 THEN
      v_a_cur := v_b_cur;
      v_f_a := v_f_b;
    ELSE
      v_f_a := v_f_a / 2;
    END IF;

    v_b_cur := v_c_cur;
    v_f_b := v_f_c;
    v_iter := v_iter + 1;
  END LOOP;

  v_sigma_prime := exp(v_a_cur / 2);
  v_phi_star := sqrt(v_phi_sq + power(v_sigma_prime, 2));
  v_phi_prime := 1 / sqrt((1 / power(v_phi_star, 2)) + (1 / v_v));
  v_mu_prime := v_mu + power(v_phi_prime, 2) * v_g * (COALESCE(p_outcome, 0) - v_e);

  new_rating := 1500 + v_scale * v_mu_prime;
  new_rd := GREATEST(30, v_scale * v_phi_prime);
  new_volatility := v_sigma_prime;
  expected := v_e;
  delta_rating := (1500 + v_scale * v_mu_prime) - COALESCE(p_rating, 1500);

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.glicko2_shadow_update_one(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glicko2_shadow_update_one(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) Apply Glicko-2 shadow for one completed/confirmed match
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_glicko2_shadow_for_match(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_mr match_results%ROWTYPE;
  v_count_p integer;
  v_distinct_players integer;
  v_t1_count integer;
  v_t2_count integer;
  v_t1_won boolean;
  v_updated integer := 0;
BEGIN
  IF p_match_result_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing match_result_id');
  END IF;

  SELECT * INTO v_mr
  FROM public.match_results
  WHERE id = p_match_result_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match result not found');
  END IF;

  IF v_mr.match_winner <> 'team1' AND v_mr.match_winner <> 'team2' THEN
    RETURN jsonb_build_object('error', 'Match must have winner team1/team2');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.glicko2_shadow_history h
    WHERE h.match_id = v_mr.match_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_applied', true,
      'players_updated', (
        SELECT COUNT(*)::int
        FROM public.glicko2_shadow_history h
        WHERE h.match_id = v_mr.match_id
      )
    );
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT user_id)::int,
    COUNT(*) FILTER (WHERE team = 1)::int,
    COUNT(*) FILTER (WHERE team = 2)::int
  INTO v_count_p, v_distinct_players, v_t1_count, v_t2_count
  FROM public.match_players
  WHERE match_id = v_mr.match_id;

  IF v_count_p <> 4 OR v_distinct_players <> 4 OR v_t1_count <> 2 OR v_t2_count <> 2 THEN
    RETURN jsonb_build_object('error', 'Glicko shadow requires exactly 2 unique players on each team');
  END IF;

  v_t1_won := (v_mr.match_winner = 'team1');

  INSERT INTO public.glicko2_shadow_ratings (user_id)
  SELECT DISTINCT mp.user_id
  FROM public.match_players mp
  WHERE mp.match_id = v_mr.match_id
  ON CONFLICT (user_id) DO NOTHING;

  WITH participants AS (
    SELECT
      mp.user_id,
      mp.team,
      sr.rating,
      sr.rd,
      sr.volatility
    FROM public.match_players mp
    JOIN public.glicko2_shadow_ratings sr ON sr.user_id = mp.user_id
    WHERE mp.match_id = v_mr.match_id
  ),
  team_stats AS (
    SELECT
      team,
      AVG(rating)::numeric AS avg_rating,
      sqrt(AVG(power(rd::numeric, 2)))::numeric AS rms_rd
    FROM participants
    GROUP BY team
  ),
  prepared AS (
    SELECT
      p.user_id,
      p.team,
      p.rating AS old_rating,
      p.rd AS old_rd,
      p.volatility AS old_volatility,
      CASE WHEN p.team = 1 THEN t2.avg_rating ELSE t1.avg_rating END AS opp_rating,
      CASE WHEN p.team = 1 THEN t2.rms_rd ELSE t1.rms_rd END AS opp_rd,
      CASE
        WHEN (p.team = 1 AND v_t1_won) OR (p.team = 2 AND NOT v_t1_won) THEN 1::numeric
        ELSE 0::numeric
      END AS outcome
    FROM participants p
    CROSS JOIN (SELECT avg_rating, rms_rd FROM team_stats WHERE team = 1) t1
    CROSS JOIN (SELECT avg_rating, rms_rd FROM team_stats WHERE team = 2) t2
  ),
  computed AS (
    SELECT
      pr.*,
      upd.new_rating,
      upd.new_rd,
      upd.new_volatility,
      upd.expected
    FROM prepared pr
    CROSS JOIN LATERAL public.glicko2_shadow_update_one(
      pr.old_rating,
      pr.old_rd,
      pr.old_volatility,
      pr.opp_rating,
      pr.opp_rd,
      pr.outcome,
      0.5,
      0.000001
    ) upd
  ),
  updated AS (
    UPDATE public.glicko2_shadow_ratings sr
    SET
      rating = c.new_rating,
      rd = c.new_rd,
      volatility = c.new_volatility,
      games_played = COALESCE(sr.games_played, 0) + 1,
      last_match_at = now(),
      updated_at = now()
    FROM computed c
    WHERE sr.user_id = c.user_id
    RETURNING sr.user_id
  ),
  inserted_history AS (
    INSERT INTO public.glicko2_shadow_history (
      match_id,
      user_id,
      old_rating,
      new_rating,
      old_rd,
      new_rd,
      old_volatility,
      new_volatility,
      expected,
      outcome
    )
    SELECT
      v_mr.match_id,
      c.user_id,
      c.old_rating,
      c.new_rating,
      c.old_rd,
      c.new_rd,
      c.old_volatility,
      c.new_volatility,
      c.expected,
      c.outcome
    FROM computed c
    ON CONFLICT (match_id, user_id) DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*)::int
  INTO v_updated
  FROM inserted_history;

  RETURN jsonb_build_object(
    'success', true,
    'players_updated', COALESCE(v_updated, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_glicko2_shadow_for_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_glicko2_shadow_for_match(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) 2v2 ELO core (official visible rating)
--    - Individual expected score vs opponent team avg
--    - K per player (based on own games_played)
--    - Zero-sum correction and floor handling
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_elo_for_match_core(
  p_match_result_id uuid,
  p_actor_id uuid,
  p_require_actor boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_can_apply boolean := false;
  v_mr match_results%ROWTYPE;
  v_match matches%ROWTYPE;
  v_t1_won boolean;

  v_t1_games integer;
  v_t2_games integer;
  v_margin integer;
  v_margin_mult numeric;

  v_count_p integer;
  v_distinct_players integer;
  v_t1_count integer;
  v_t2_count integer;

  v_updated_count integer := 0;
  v_zero_sum_residual integer := 0;

  v_t1_changes integer[] := ARRAY[]::integer[];
  v_t2_changes integer[] := ARRAY[]::integer[];

  v_shadow jsonb := '{}'::jsonb;
BEGIN
  IF p_match_result_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing match_result_id');
  END IF;

  IF COALESCE(p_require_actor, true) AND p_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Authentication required');
  END IF;

  IF current_user IN ('anon', 'authenticated') THEN
    IF COALESCE(p_require_actor, true) AND p_actor_id IS DISTINCT FROM auth.uid() THEN
      RETURN jsonb_build_object('error', 'Authentication required');
    END IF;
    IF NOT COALESCE(p_require_actor, true) THEN
      RETURN jsonb_build_object('error', 'Not authorized');
    END IF;
  END IF;

  SELECT * INTO v_mr
  FROM public.match_results
  WHERE id = p_match_result_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match result not found');
  END IF;

  IF v_mr.confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Match result not confirmed yet');
  END IF;

  IF NOT public.has_valid_match_result_confirmation(v_mr.match_id, v_mr.submitted_by, v_mr.confirmed_by) THEN
    RETURN jsonb_build_object('error', 'Result was not confirmed by an opposing team player or admin');
  END IF;

  IF COALESCE(p_require_actor, true) THEN
    SELECT
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.match_players mp
        WHERE mp.match_id = v_mr.match_id
          AND mp.user_id = p_actor_id
      )
    INTO v_can_apply;

    IF NOT v_can_apply THEN
      RETURN jsonb_build_object('error', 'Not authorized to apply ELO for this match');
    END IF;
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = v_mr.match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Match not found');
  END IF;

  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('error', 'ELO already calculated for this match');
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT user_id)::int,
    COUNT(*) FILTER (WHERE team = 1)::int,
    COUNT(*) FILTER (WHERE team = 2)::int
  INTO v_count_p, v_distinct_players, v_t1_count, v_t2_count
  FROM public.match_players
  WHERE match_id = v_mr.match_id;

  IF v_count_p <> 4 OR v_distinct_players <> 4 OR v_t1_count <> 2 OR v_t2_count <> 2 THEN
    RETURN jsonb_build_object('error', 'ELO requires exactly 2 unique players on each team');
  END IF;

  IF v_mr.match_winner <> 'team1' AND v_mr.match_winner <> 'team2' THEN
    RETURN jsonb_build_object('error', 'Match must have a distinct winner (team1 or team2) for ELO to apply');
  END IF;

  v_t1_won := (v_mr.match_winner = 'team1');

  v_t1_games :=
    COALESCE(v_mr.set1_team1, 0) + COALESCE(v_mr.set2_team1, 0) + COALESCE(v_mr.set3_team1, 0);
  v_t2_games :=
    COALESCE(v_mr.set1_team2, 0) + COALESCE(v_mr.set2_team2, 0) + COALESCE(v_mr.set3_team2, 0);
  v_margin := abs(v_t1_games - v_t2_games);

  v_margin_mult := CASE
    WHEN v_margin <= 4 THEN 1.0
    WHEN v_margin <= 9 THEN 1.20
    WHEN v_margin <= 14 THEN 1.40
    ELSE 1.60
  END;

  PERFORM set_config('app.bypass_profile_protection', 'on', true);

  WITH participants AS (
    SELECT
      mp.user_id,
      mp.team,
      COALESCE(p.elo_rating, 1000)::numeric AS old_rating,
      COALESCE(p.games_played, 0)::int AS games_played
    FROM public.match_players mp
    JOIN public.profiles p ON p.id = mp.user_id
    WHERE mp.match_id = v_mr.match_id
  ),
  team_avg AS (
    SELECT
      team,
      AVG(old_rating)::numeric AS avg_rating
    FROM participants
    GROUP BY team
  ),
  base AS (
    SELECT
      p.user_id,
      p.team,
      p.old_rating,
      p.games_played,
      CASE WHEN p.team = 1 THEN t2.avg_rating ELSE t1.avg_rating END AS opp_avg,
      CASE
        WHEN (p.team = 1 AND v_t1_won) OR (p.team = 2 AND NOT v_t1_won) THEN 1::numeric
        ELSE 0::numeric
      END AS outcome,
      CASE
        WHEN p.games_played < 10 THEN 56::numeric
        WHEN p.games_played < 30 THEN 44::numeric
        ELSE 32::numeric
      END AS k_value
    FROM participants p
    CROSS JOIN (SELECT avg_rating FROM team_avg WHERE team = 1) t1
    CROSS JOIN (SELECT avg_rating FROM team_avg WHERE team = 2) t2
  ),
  raw AS (
    SELECT
      b.*,
      (1::numeric / (1::numeric + power(10::numeric, (b.opp_avg - b.old_rating) / 400::numeric))) AS expected,
      (
        b.k_value
        * (
            b.outcome
            - (1::numeric / (1::numeric + power(10::numeric, (b.opp_avg - b.old_rating) / 400::numeric)))
          )
        * v_margin_mult
      ) AS delta_raw
    FROM base b
  ),
  centered AS (
    SELECT
      r.*,
      (r.delta_raw - AVG(r.delta_raw) OVER ()) AS delta_centered
    FROM raw r
  ),
  rounded AS (
    SELECT
      c.*,
      round(c.delta_centered)::int AS delta_rounded
    FROM centered c
  ),
  rounded_total AS (
    SELECT COALESCE(SUM(delta_rounded), 0)::int AS total_delta
    FROM rounded
  ),
  correction_rank AS (
    SELECT
      r.*,
      (r.delta_rounded::numeric - r.delta_centered) AS rounding_residual,
      rt.total_delta,
      CASE
        WHEN rt.total_delta > 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_centered) DESC, r.delta_rounded DESC, r.user_id
        )
        WHEN rt.total_delta < 0 THEN row_number() OVER (
          ORDER BY (r.delta_rounded::numeric - r.delta_centered) ASC, r.delta_rounded ASC, r.user_id
        )
        ELSE 0
      END AS correction_order
    FROM rounded r
    CROSS JOIN rounded_total rt
  ),
  deltas_fixed AS (
    SELECT
      c.user_id,
      c.team,
      c.old_rating,
      c.games_played,
      c.outcome,
      c.k_value,
      c.expected,
      c.opp_avg,
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
  capped AS (
    SELECT
      d.*,
      (100 - d.old_rating)::int AS min_delta,
      GREATEST(d.delta, (100 - d.old_rating)::int)::int AS delta_capped
    FROM deltas_fixed d
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
      ca.team,
      ca.old_rating,
      ca.outcome,
      ca.k_value,
      ca.expected,
      ca.opp_avg,
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
      elo_rating = GREATEST(100, ROUND(f.old_rating + f.delta)::int),
      games_played = COALESCE(p.games_played, 0) + 1,
      games_won = COALESCE(p.games_won, 0) + CASE WHEN f.outcome = 1 THEN 1 ELSE 0 END
    FROM final_applied f
    WHERE p.id = f.user_id
    RETURNING p.id
  ),
  inserted_history AS (
    INSERT INTO public.elo_history (
      user_id,
      match_id,
      old_rating,
      new_rating,
      change,
      result
    )
    SELECT
      f.user_id,
      v_mr.match_id,
      f.old_rating,
      GREATEST(100, ROUND(f.old_rating + f.delta)::int),
      f.delta,
      CASE WHEN f.outcome = 1 THEN 'win' ELSE 'loss' END
    FROM final_applied f
    RETURNING id
  ),
  aggregates AS (
    SELECT
      COALESCE((SELECT COUNT(*)::int FROM inserted_history), 0) AS players_updated,
      COALESCE((SELECT SUM(delta)::int FROM final_applied), 0) AS total_delta,
      COALESCE((SELECT array_agg(delta ORDER BY user_id) FILTER (WHERE team = 1) FROM final_applied), ARRAY[]::int[]) AS t1_changes,
      COALESCE((SELECT array_agg(delta ORDER BY user_id) FILTER (WHERE team = 2) FROM final_applied), ARRAY[]::int[]) AS t2_changes
  )
  SELECT
    a.players_updated,
    a.total_delta,
    a.t1_changes,
    a.t2_changes
  INTO v_updated_count, v_zero_sum_residual, v_t1_changes, v_t2_changes
  FROM aggregates a;

  UPDATE public.matches
  SET status = 'completed', completed_at = now()
  WHERE id = v_mr.match_id;

  BEGIN
    v_shadow := public.apply_glicko2_shadow_for_match(p_match_result_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_shadow := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true,
    'model', 'elo_v2_individual_expected_zero_sum',
    'players_updated', COALESCE(v_updated_count, 0),
    'winner', v_mr.match_winner,
    'games_team1', v_t1_games,
    'games_team2', v_t2_games,
    'games_margin', v_margin,
    'margin_multiplier', v_margin_mult,
    'team1_player_changes', to_jsonb(v_t1_changes),
    'team2_player_changes', to_jsonb(v_t2_changes),
    'zero_sum_residual', COALESCE(v_zero_sum_residual, 0),
    'shadow', v_shadow
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_elo_for_match_core(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_elo_for_match_core(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.apply_elo_for_match_core(uuid, uuid, boolean) FROM authenticated;

-- -----------------------------------------------------------------------------
-- 4) Public wrappers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_elo_for_match(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN public.apply_elo_for_match_core(p_match_result_id, v_uid, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_elo_for_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_elo_for_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_elo_for_match_system(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
BEGIN
  RETURN public.apply_elo_for_match_core(p_match_result_id, NULL, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_elo_for_match_system(uuid) FROM PUBLIC;
-- no grant: only internal server-side use (e.g. auto-confirm function)

NOTIFY pgrst, 'reload schema';
