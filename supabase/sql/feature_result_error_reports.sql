-- =============================================================================
-- Indberet fejl på afsluttede kampe/turneringer/ligaer (opretter, 24t vindue)
-- Kør i Supabase → SQL Editor.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.result_error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  entity_completed_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT result_error_reports_source_chk CHECK (
    source_type IN ('match_2v2', 'americano', 'league')
  ),
  CONSTRAINT result_error_reports_reason_chk CHECK (
    reason IN ('elo', 'points', 'result', 'other')
  ),
  CONSTRAINT result_error_reports_status_chk CHECK (
    status IN ('open', 'resolved', 'dismissed')
  ),
  CONSTRAINT result_error_reports_entity_unique UNIQUE (source_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_result_error_reports_status_created
  ON public.result_error_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_result_error_reports_reporter
  ON public.result_error_reports (reporter_id, created_at DESC);

ALTER TABLE public.result_error_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS result_error_reports_select_own ON public.result_error_reports;
CREATE POLICY result_error_reports_select_own ON public.result_error_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS result_error_reports_admin_all ON public.result_error_reports;
CREATE POLICY result_error_reports_admin_all ON public.result_error_reports
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Helpers ───────────────────────────────────────────────────────────────────

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
BEGIN
  IF p_source_type = 'match_2v2' THEN
    SELECT coalesce(
      m.completed_at,
      (
        SELECT max(coalesce(mr.confirmed_at, mr.updated_at, mr.created_at))
        FROM public.match_results mr
        WHERE mr.match_id = m.id
      ),
      m.updated_at,
      m.created_at
    )
    INTO v_ts
    FROM public.matches m
    WHERE m.id = p_entity_id;
  ELSIF p_source_type = 'americano' THEN
    SELECT coalesce(t.updated_at, t.created_at)
    INTO v_ts
    FROM public.americano_tournaments t
    WHERE t.id = p_entity_id;
  ELSIF p_source_type = 'league' THEN
    SELECT coalesce(l.updated_at, l.end_date::timestamptz, l.created_at)
    INTO v_ts
    FROM public.leagues l
    WHERE l.id = p_entity_id;
  END IF;

  RETURN v_ts;
END;
$$;

REVOKE ALL ON FUNCTION public._result_error_entity_completed_at(text, uuid) FROM PUBLIC;

-- ── Submit (kun opretter, afsluttet, inden 24 timer) ─────────────────────────

CREATE OR REPLACE FUNCTION public.submit_result_error_report(
  p_source_type text,
  p_entity_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_details text;
  v_completed_at timestamptz;
  v_entity_label text;
  v_reporter_name text;
  v_reason_label text;
  v_is_creator boolean := false;
  v_status text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke indberette fejl');
  END IF;
  IF p_source_type NOT IN ('match_2v2', 'americano', 'league') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig kildetype');
  END IF;
  IF p_entity_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Manglende reference');
  END IF;
  IF p_reason NOT IN ('elo', 'points', 'result', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en gyldig fejltype');
  END IF;

  v_details := nullif(trim(coalesce(p_details, '')), '');
  IF length(v_details) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beskrivelsen er for lang (max 2000 tegn)');
  END IF;

  IF p_source_type = 'match_2v2' THEN
    SELECT
      (m.creator_id = v_caller),
      m.status,
      coalesce(nullif(trim(m.court_name), ''), '2v2-kamp')
    INTO v_is_creator, v_status, v_entity_label
    FROM public.matches m
    WHERE m.id = p_entity_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kampen findes ikke');
    END IF;
    IF v_status IS DISTINCT FROM 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede kampe kan indberettes');
    END IF;
  ELSIF p_source_type = 'americano' THEN
    SELECT
      (t.creator_id = v_caller),
      t.status,
      coalesce(nullif(trim(t.name), ''), 'Americano')
    INTO v_is_creator, v_status, v_entity_label
    FROM public.americano_tournaments t
    WHERE t.id = p_entity_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Turneringen findes ikke');
    END IF;
    IF v_status IS DISTINCT FROM 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede turneringer kan indberettes');
    END IF;
  ELSE
    SELECT
      (l.created_by = v_caller),
      l.status,
      coalesce(nullif(trim(l.name), ''), 'Liga')
    INTO v_is_creator, v_status, v_entity_label
    FROM public.leagues l
    WHERE l.id = p_entity_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Ligaen findes ikke');
    END IF;
    IF v_status IS DISTINCT FROM 'completed' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kun afsluttede ligaer kan indberettes');
    END IF;
  END IF;

  IF NOT v_is_creator THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun opretteren kan indberette fejl');
  END IF;

  v_completed_at := public._result_error_entity_completed_at(p_source_type, p_entity_id);
  IF v_completed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kunne ikke fastslå afslutningstidspunkt');
  END IF;
  IF now() > v_completed_at + interval '24 hours' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Fristen på 24 timer efter afslutning er udløbet'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.result_error_reports r
    WHERE r.source_type = p_source_type
      AND r.entity_id = p_entity_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Der er allerede indberettet en fejl for dette');
  END IF;

  INSERT INTO public.result_error_reports (
    reporter_id,
    source_type,
    entity_id,
    reason,
    details,
    entity_completed_at,
    status
  )
  VALUES (
    v_caller,
    p_source_type,
    p_entity_id,
    p_reason,
    v_details,
    v_completed_at,
    'open'
  );

  SELECT coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(name), ''),
    'En spiller'
  )
  INTO v_reporter_name
  FROM public.profiles
  WHERE id = v_caller;

  v_reason_label := CASE p_reason
    WHEN 'elo' THEN 'ELO'
    WHEN 'points' THEN 'Point'
    WHEN 'result' THEN 'Resultat'
    ELSE 'Andet'
  END;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT
        p.id,
        'result_error_report',
        'Fejl indberettet',
        format(
          '%s indberettede fejl (%s) på %s. Gå til Admin → Fejl.',
          v_reporter_name,
          v_reason_label,
          v_entity_label
        ),
        CASE WHEN p_source_type = 'match_2v2' THEN p_entity_id ELSE NULL END,
        false
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin';
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notify_title', 'Fejl indberettet',
    'notify_body', format(
      '%s indberettede fejl (%s) på %s. Gå til Admin → Fejl.',
      v_reporter_name,
      v_reason_label,
      v_entity_label
    ),
    'admin_ids', (
      SELECT coalesce(jsonb_agg(p.id), '[]'::jsonb)
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_result_error_report(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_result_error_report(text, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_open_result_error_reports_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(COALESCE(p.role, '')) = 'admin'
    )
    THEN (
      SELECT count(*)::integer
      FROM public.result_error_reports r
      WHERE r.status = 'open'
    )
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.admin_open_result_error_reports_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_open_result_error_reports_count() TO authenticated;
