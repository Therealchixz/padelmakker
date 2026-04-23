-- =============================================================================
-- Admin PIN gate (6-digit ekstra sikkerhed for admin-adgang)
-- Kør denne SQL i Supabase SQL Editor.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_pin_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  lock_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_pin_sessions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  verified_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_pin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_pin_sessions ENABLE ROW LEVEL SECURITY;

-- Ingen direkte læse-/skrive-policy: adgang kun via SECURITY DEFINER-funktioner.
REVOKE ALL ON public.admin_pin_settings FROM PUBLIC;
REVOKE ALL ON public.admin_pin_sessions FROM PUBLIC;
REVOKE ALL ON public.admin_pin_settings FROM authenticated;
REVOKE ALL ON public.admin_pin_sessions FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_pin_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_has_pin boolean := false;
  v_verified_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Kun admins';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_pin_settings s WHERE s.user_id = v_uid
  ) INTO v_has_pin;

  SELECT sess.verified_until
  INTO v_verified_until
  FROM public.admin_pin_sessions sess
  WHERE sess.user_id = v_uid;

  RETURN jsonb_build_object(
    'has_pin', v_has_pin,
    'is_verified', COALESCE(v_verified_until > now(), false),
    'verified_until', v_verified_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_setup_pin(
  p_pin text,
  p_remember_minutes integer DEFAULT 720
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_until timestamptz;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 720), 10080));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Kun admins';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'PIN skal være præcis 6 tal';
  END IF;

  INSERT INTO public.admin_pin_settings AS s (user_id, pin_hash, failed_attempts, lock_until, updated_at)
  VALUES (v_uid, crypt(p_pin, gen_salt('bf', 10)), 0, NULL, now())
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
  p_remember_minutes integer DEFAULT 720
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_setting public.admin_pin_settings%ROWTYPE;
  v_until timestamptz;
  v_attempts integer;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 720), 10080));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_uid
      AND p.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
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

  IF crypt(p_pin, v_setting.pin_hash) <> v_setting.pin_hash THEN
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

  RETURN jsonb_build_object(
    'ok', true,
    'verified_until', v_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_pin_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.admin_pin_sessions WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_pin_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_setup_pin(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_verify_pin(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_clear_pin_session() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_pin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_setup_pin(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_pin(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_pin_session() TO authenticated;
