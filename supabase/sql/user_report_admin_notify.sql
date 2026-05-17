-- =============================================================================
-- Ved spilleranmeldelse: notificer alle admins + tæl åbne anmeldelser til badge
-- Kør i Supabase → SQL Editor (efter user_blocks_and_reports.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_id uuid,
  p_reason text,
  p_details text DEFAULT NULL,
  p_context text DEFAULT 'dm'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_details text;
  v_reporter_name text;
  v_reported_name text;
  v_reason_label text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;
  IF p_reported_id IS NULL OR p_reported_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ugyldig bruger');
  END IF;
  IF p_reason NOT IN ('harassment', 'spam', 'inappropriate', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en gyldig årsag');
  END IF;
  IF public.is_banned() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din konto kan ikke anmelde spillere');
  END IF;

  v_details := nullif(trim(coalesce(p_details, '')), '');
  IF length(v_details) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Beskrivelsen er for lang (max 2000 tegn)');
  END IF;

  INSERT INTO public.user_reports (reporter_id, reported_id, reason, details, context)
  VALUES (
    v_caller,
    p_reported_id,
    p_reason,
    v_details,
    coalesce(nullif(trim(p_context), ''), 'dm')
  );

  SELECT coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(name), ''),
    'En spiller'
  )
  INTO v_reporter_name
  FROM public.profiles
  WHERE id = v_caller;

  SELECT coalesce(
    nullif(trim(full_name), ''),
    nullif(trim(name), ''),
    'En spiller'
  )
  INTO v_reported_name
  FROM public.profiles
  WHERE id = p_reported_id;

  v_reason_label := CASE p_reason
    WHEN 'harassment' THEN 'Chikane eller trusler'
    WHEN 'spam' THEN 'Spam eller reklame'
    WHEN 'inappropriate' THEN 'Upassende indhold'
    ELSE 'Andet'
  END;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
      SELECT
        p.id,
        'user_report',
        'Ny spilleranmeldelse',
        format(
          '%s har anmeldt %s (%s). Gå til Admin → Anmeldelser for at gennemgå.',
          v_reporter_name,
          v_reported_name,
          v_reason_label
        ),
        NULL,
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
    'notify_title', 'Ny spilleranmeldelse',
    'notify_body', format(
      '%s har anmeldt %s (%s). Gå til Admin → Anmeldelser for at gennemgå.',
      v_reporter_name,
      v_reported_name,
      v_reason_label
    ),
    'admin_ids', (
      SELECT coalesce(jsonb_agg(p.id), '[]'::jsonb)
      FROM public.profiles p
      WHERE lower(COALESCE(p.role, '')) = 'admin'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, text, text, text) TO authenticated;

-- Antal åbne anmeldelser (til badge i admin-menu; kræver kun role=admin, ikke PIN)
CREATE OR REPLACE FUNCTION public.admin_open_user_reports_count()
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
      FROM public.user_reports r
      WHERE r.status = 'open'
    )
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.admin_open_user_reports_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_open_user_reports_count() TO authenticated;
