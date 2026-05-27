-- =============================================================================
-- ELO hardening pack
-- 1) Engine versioning i ELO-historik
-- 2) Americano backend-guardrails ved afslutning
-- 3) Auto-flag + admin-notifikation (ingen automatisk ELO-aendring)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Engine versioning
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.elo_history') IS NOT NULL THEN
    ALTER TABLE public.elo_history ADD COLUMN IF NOT EXISTS rating_engine text;
    ALTER TABLE public.elo_history ADD COLUMN IF NOT EXISTS rating_meta jsonb;

    UPDATE public.elo_history
    SET
      rating_engine = COALESCE(rating_engine, 'legacy_unknown'),
      rating_meta = COALESCE(rating_meta, '{}'::jsonb)
    WHERE rating_engine IS NULL OR rating_meta IS NULL;

    ALTER TABLE public.elo_history ALTER COLUMN rating_engine SET NOT NULL;
    ALTER TABLE public.elo_history ALTER COLUMN rating_meta SET NOT NULL;
    ALTER TABLE public.elo_history ALTER COLUMN rating_engine SET DEFAULT 'elo_v2_individual_expected_zero_sum_v1';
    ALTER TABLE public.elo_history ALTER COLUMN rating_meta SET DEFAULT '{}'::jsonb;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.americano_elo_history') IS NOT NULL THEN
    ALTER TABLE public.americano_elo_history ADD COLUMN IF NOT EXISTS rating_engine text;
    ALTER TABLE public.americano_elo_history ADD COLUMN IF NOT EXISTS rating_meta jsonb;

    UPDATE public.americano_elo_history
    SET
      rating_engine = COALESCE(rating_engine, 'legacy_unknown'),
      rating_meta = COALESCE(rating_meta, '{}'::jsonb)
    WHERE rating_engine IS NULL OR rating_meta IS NULL;

    ALTER TABLE public.americano_elo_history ALTER COLUMN rating_engine SET NOT NULL;
    ALTER TABLE public.americano_elo_history ALTER COLUMN rating_meta SET NOT NULL;
    ALTER TABLE public.americano_elo_history ALTER COLUMN rating_engine SET DEFAULT 'americano_elo_v1_dynamic_k';
    ALTER TABLE public.americano_elo_history ALTER COLUMN rating_meta SET DEFAULT '{}'::jsonb;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trg_set_elo_history_engine_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.rating_engine IS NULL OR btrim(NEW.rating_engine) = '' THEN
    IF NEW.match_id IS NOT NULL THEN
      NEW.rating_engine := 'elo_v2_individual_expected_zero_sum_v1';
    ELSIF lower(COALESCE(NEW.result, '')) = 'admin_adjust' THEN
      NEW.rating_engine := 'elo_admin_adjust_v1';
    ELSE
      NEW.rating_engine := 'legacy_unknown';
    END IF;
  END IF;

  IF NEW.rating_meta IS NULL THEN
    NEW.rating_meta := '{}'::jsonb;
  END IF;

  IF NEW.match_id IS NOT NULL THEN
    NEW.rating_meta := jsonb_strip_nulls(
      COALESCE(NEW.rating_meta, '{}'::jsonb)
      || jsonb_build_object(
        'mode', '2v2',
        'source', 'apply_elo_for_match_core'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.elo_history') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_set_elo_history_engine_meta ON public.elo_history;
    CREATE TRIGGER trg_set_elo_history_engine_meta
      BEFORE INSERT ON public.elo_history
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_set_elo_history_engine_meta();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.trg_set_americano_elo_history_engine_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.rating_engine IS NULL OR btrim(NEW.rating_engine) = '' THEN
    NEW.rating_engine := 'americano_elo_v1_dynamic_k';
  END IF;

  IF NEW.rating_meta IS NULL THEN
    NEW.rating_meta := '{}'::jsonb;
  END IF;

  NEW.rating_meta := jsonb_strip_nulls(
    COALESCE(NEW.rating_meta, '{}'::jsonb)
    || jsonb_build_object(
      'mode', 'americano',
      'source', 'apply_americano_elo_for_tournament'
    )
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.americano_elo_history') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_set_americano_elo_history_engine_meta ON public.americano_elo_history;
    CREATE TRIGGER trg_set_americano_elo_history_engine_meta
      BEFORE INSERT ON public.americano_elo_history
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_set_americano_elo_history_engine_meta();
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2) Americano backend-guardrails
-- -----------------------------------------------------------------------------

-- Americano afslutnings-guard: kør supabase/sql/americano_expected_match_count_v2.sql
-- (americano_round_robin_base_rounds, americano_match_count_is_valid, guard_americano_complete_transition)

DO $$
BEGIN
  IF to_regclass('public.americano_tournaments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_guard_americano_complete_transition ON public.americano_tournaments;
    CREATE TRIGGER trg_guard_americano_complete_transition
      BEFORE UPDATE OF status ON public.americano_tournaments
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_americano_complete_transition();
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 3) Auto-flag + admin-notifikation (ingen auto-aendring af ELO)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rating_admin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('2v2', 'americano')),
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  match_id uuid NULL REFERENCES public.matches(id) ON DELETE SET NULL,
  tournament_id uuid NULL REFERENCES public.americano_tournaments(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  review_note text NULL
);

CREATE INDEX IF NOT EXISTS idx_rating_admin_flags_status_created
  ON public.rating_admin_flags (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rating_admin_flags_match
  ON public.rating_admin_flags (match_id);

CREATE INDEX IF NOT EXISTS idx_rating_admin_flags_tournament
  ON public.rating_admin_flags (tournament_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rating_admin_flags_unique_match_reason
  ON public.rating_admin_flags (source, reason, match_id)
  WHERE match_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rating_admin_flags_unique_tournament_reason
  ON public.rating_admin_flags (source, reason, tournament_id)
  WHERE tournament_id IS NOT NULL;

ALTER TABLE public.rating_admin_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rating_admin_flags_select_admin ON public.rating_admin_flags;
CREATE POLICY rating_admin_flags_select_admin
  ON public.rating_admin_flags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) = 'admin'
    )
  );

DROP POLICY IF EXISTS rating_admin_flags_update_admin ON public.rating_admin_flags;
CREATE POLICY rating_admin_flags_update_admin
  ON public.rating_admin_flags
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) = 'admin'
    )
  );

DROP POLICY IF EXISTS rating_admin_flags_insert_deny ON public.rating_admin_flags;
CREATE POLICY rating_admin_flags_insert_deny
  ON public.rating_admin_flags
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS rating_admin_flags_delete_deny ON public.rating_admin_flags;
CREATE POLICY rating_admin_flags_delete_deny
  ON public.rating_admin_flags
  FOR DELETE TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.create_rating_admin_flag(
  p_source text,
  p_reason text,
  p_severity text DEFAULT 'medium',
  p_match_id uuid DEFAULT NULL,
  p_tournament_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_notify_admins boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_source text;
  v_severity text;
  v_reason text;
  v_payload jsonb;
  v_flag_id uuid;
  v_inserted boolean := false;
BEGIN
  v_source := CASE WHEN p_source IN ('2v2', 'americano') THEN p_source ELSE '2v2' END;
  v_severity := CASE WHEN p_severity IN ('low', 'medium', 'high') THEN p_severity ELSE 'medium' END;
  v_reason := COALESCE(NULLIF(btrim(p_reason), ''), 'unspecified');
  v_payload := COALESCE(p_payload, '{}'::jsonb);

  BEGIN
    INSERT INTO public.rating_admin_flags (
      source,
      reason,
      severity,
      status,
      match_id,
      tournament_id,
      payload
    )
    VALUES (
      v_source,
      v_reason,
      v_severity,
      'open',
      p_match_id,
      p_tournament_id,
      v_payload
    )
    RETURNING id INTO v_flag_id;

    v_inserted := true;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT f.id
      INTO v_flag_id
      FROM public.rating_admin_flags f
      WHERE f.source = v_source
        AND f.reason = v_reason
        AND (
          (p_match_id IS NOT NULL AND f.match_id = p_match_id)
          OR (p_tournament_id IS NOT NULL AND f.tournament_id = p_tournament_id)
        )
      ORDER BY f.created_at DESC
      LIMIT 1;
  END;

  IF v_inserted AND COALESCE(p_notify_admins, true) AND to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT
        p.id,
        'system_flag',
        'Auto-flag: mulig ELO-manipulation',
        format(
          'Flag: %s (%s). Match: %s. Se Admin for vurdering.',
          v_reason,
          v_severity,
          COALESCE(p_match_id::text, 'n/a')
        ),
        p_match_id,
        false
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin';
    EXCEPTION
      WHEN OTHERS THEN
        -- Notifikation maa ikke blokere ELO-flow.
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'flag_id', v_flag_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_rating_admin_flag(text, text, text, uuid, uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_rating_admin_flag(text, text, text, uuid, uuid, jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.create_rating_admin_flag(text, text, text, uuid, uuid, jsonb, boolean) FROM authenticated;

CREATE OR REPLACE FUNCTION public.detect_and_flag_suspicious_2v2_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_player_count integer := 0;
  v_distinct_players integer := 0;
  v_team1_count integer := 0;
  v_team2_count integer := 0;
  v_same_quartet_14d integer := 0;
  v_max_abs_change integer := 0;
  v_min_abs_change integer := 0;
  v_sum_change integer := 0;
  v_open_flags integer := 0;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_match_id');
  END IF;

  SELECT
    COUNT(*)::int,
    COUNT(DISTINCT mp.user_id)::int,
    COUNT(*) FILTER (WHERE mp.team = 1)::int,
    COUNT(*) FILTER (WHERE mp.team = 2)::int
  INTO v_player_count, v_distinct_players, v_team1_count, v_team2_count
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id;

  IF v_player_count <> 4 OR v_distinct_players <> 4 OR v_team1_count <> 2 OR v_team2_count <> 2 THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'not_standard_2v2');
  END IF;

  -- Vent til alle 4 ELO-raekker er skrevet.
  IF (
    SELECT COUNT(*)::int
    FROM public.elo_history eh
    WHERE eh.match_id = p_match_id
  ) < 4 THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'elo_rows_not_ready');
  END IF;

  WITH this_sig AS (
    SELECT string_agg(mp.user_id::text, ',' ORDER BY mp.user_id::text) AS sig
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
  ),
  recent_match_sigs AS (
    SELECT
      m.id AS match_id,
      string_agg(mp.user_id::text, ',' ORDER BY mp.user_id::text) AS sig
    FROM public.matches m
    JOIN public.match_players mp ON mp.match_id = m.id
    WHERE m.status = 'completed'
      AND COALESCE(m.completed_at, now()) >= now() - interval '14 days'
    GROUP BY m.id
    HAVING COUNT(*) = 4 AND COUNT(DISTINCT mp.user_id) = 4
  )
  SELECT COUNT(*)::int
  INTO v_same_quartet_14d
  FROM recent_match_sigs r
  JOIN this_sig t ON t.sig = r.sig;

  SELECT
    COALESCE(MAX(abs(eh.change)), 0)::int,
    COALESCE(MIN(abs(eh.change)), 0)::int,
    COALESCE(SUM(eh.change), 0)::int
  INTO v_max_abs_change, v_min_abs_change, v_sum_change
  FROM public.elo_history eh
  WHERE eh.match_id = p_match_id;

  IF v_same_quartet_14d >= 8 THEN
    PERFORM public.create_rating_admin_flag(
      '2v2',
      'repeated_quartet_high_volume_14d',
      'high',
      p_match_id,
      NULL,
      jsonb_build_object(
        'same_quartet_14d', v_same_quartet_14d,
        'window_days', 14
      ),
      true
    );
  END IF;

  IF abs(v_sum_change) > 0 THEN
    PERFORM public.create_rating_admin_flag(
      '2v2',
      'non_zero_sum_match_delta',
      'medium',
      p_match_id,
      NULL,
      jsonb_build_object(
        'sum_change', v_sum_change,
        'max_abs_change', v_max_abs_change,
        'min_abs_change', v_min_abs_change
      ),
      true
    );
  END IF;

  IF v_max_abs_change >= 60 AND v_min_abs_change <= 3 THEN
    PERFORM public.create_rating_admin_flag(
      '2v2',
      'extreme_delta_spread',
      'medium',
      p_match_id,
      NULL,
      jsonb_build_object(
        'max_abs_change', v_max_abs_change,
        'min_abs_change', v_min_abs_change
      ),
      true
    );
  END IF;

  SELECT COUNT(*)::int
  INTO v_open_flags
  FROM public.rating_admin_flags f
  WHERE f.match_id = p_match_id
    AND f.status = 'open';

  RETURN jsonb_build_object(
    'success', true,
    'same_quartet_14d', v_same_quartet_14d,
    'max_abs_change', v_max_abs_change,
    'min_abs_change', v_min_abs_change,
    'sum_change', v_sum_change,
    'open_flags_for_match', v_open_flags
  );
END;
$$;

REVOKE ALL ON FUNCTION public.detect_and_flag_suspicious_2v2_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_and_flag_suspicious_2v2_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_elo_history_auto_flag_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.match_id IS NOT NULL THEN
    BEGIN
      PERFORM public.detect_and_flag_suspicious_2v2_match(NEW.match_id);
    EXCEPTION
      WHEN OTHERS THEN
        -- Flagging maa aldrig stoppe selve ELO-opdateringen.
        NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.elo_history') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_elo_history_auto_flag_match ON public.elo_history;
    CREATE TRIGGER trg_elo_history_auto_flag_match
      AFTER INSERT ON public.elo_history
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_elo_history_auto_flag_match();
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
