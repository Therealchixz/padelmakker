-- =============================================================================
-- Admin PIN: kortere session (30 min default, max 60 min fra klient)
-- Kør i Supabase SQL Editor efter admin_pin_guard.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_setup_pin(
  p_pin text,
  p_remember_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_until timestamptz;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 30), 60));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF NOT public.has_admin_role() THEN
    RAISE EXCEPTION 'Kun admins';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN skal være præcis 6 tal';
  END IF;

  INSERT INTO public.admin_pin_settings AS s (user_id, pin_hash, failed_attempts, lock_until, updated_at)
  VALUES (v_uid, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        failed_attempts = 0,
        lock_until = NULL,
        updated_at = now();

  v_until := now() + make_interval(mins => v_minutes);

  INSERT INTO public.admin_pin_sessions AS sess (user_id, verified_until, updated_at)
  VALUES (v_uid, v_until, now())
  ON CONFLICT (user_id) DO UPDATE
    SET verified_until = EXCLUDED.verified_until,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'verified_until', v_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_pin(
  p_pin text,
  p_remember_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_setting public.admin_pin_settings%ROWTYPE;
  v_until timestamptz;
  v_attempts integer;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 30), 60));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF NOT public.has_admin_role() THEN
    RAISE EXCEPTION 'Kun admins';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT *
  INTO v_setting
  FROM public.admin_pin_settings s
  WHERE s.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_configured');
  END IF;

  IF v_setting.lock_until IS NOT NULL AND v_setting.lock_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'locked',
      'locked_until', v_setting.lock_until
    );
  END IF;

  IF extensions.crypt(p_pin, v_setting.pin_hash) <> v_setting.pin_hash THEN
    v_attempts := COALESCE(v_setting.failed_attempts, 0) + 1;
    UPDATE public.admin_pin_settings s
      SET failed_attempts = v_attempts,
          lock_until = CASE WHEN v_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
          updated_at = now()
    WHERE s.user_id = v_uid;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN v_attempts >= 5 THEN 'locked' ELSE 'invalid' END,
      'attempts_left', GREATEST(0, 5 - v_attempts)
    );
  END IF;

  UPDATE public.admin_pin_settings s
    SET failed_attempts = 0,
        lock_until = NULL,
        updated_at = now()
  WHERE s.user_id = v_uid;

  v_until := now() + make_interval(mins => v_minutes);

  INSERT INTO public.admin_pin_sessions AS sess (user_id, verified_until, updated_at)
  VALUES (v_uid, v_until, now())
  ON CONFLICT (user_id) DO UPDATE
    SET verified_until = EXCLUDED.verified_until,
        updated_at = now();

  PERFORM public._admin_audit_log(
    'pin_verified',
    NULL,
    jsonb_build_object('remember_minutes', v_minutes)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'verified_until', v_until
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
