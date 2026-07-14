-- Migration 20260519193959_admin_security_phase3_core
-- Backfilled from sql:_p3a.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- =============================================================================
-- Admin security phase 3
-- 1) PIN-session 30 min (max 60 fra klient)
-- 2) has_admin_role() + is_admin() med max JWT-alder for admin (8 timer)
-- 3) admin_audit_log + intern logging
-- 4) RPC'er: kun is_admin() / is_user_admin_verified (ikke rå role=admin)
-- 5) protect_elo_fields: phone_verification_exempt
-- Kør i Supabase SQL Editor (eller apply_migration).
-- =============================================================================

-- ─── 1) has_admin_role (rolle uden PIN — til PIN-setup og menu-badges) ───────

CREATE OR REPLACE FUNCTION public.has_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(COALESCE(p.role, '')) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.has_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_role() TO authenticated;

-- ─── 2) is_admin: rolle + PIN + max JWT-alder (8 timer siden iat) ───────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_role boolean := false;
  v_pin_verified boolean := false;
  v_iat bigint;
  v_max_admin_jwt_seconds constant integer := 8 * 3600;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT public.has_admin_role() INTO v_has_role;
  IF NOT COALESCE(v_has_role, false) THEN
    RETURN false;
  END IF;

  v_iat := NULLIF(auth.jwt() ->> 'iat', '')::bigint;
  IF v_iat IS NULL OR (extract(epoch FROM now())::bigint - v_iat) > v_max_admin_jwt_seconds THEN
    RETURN false;
  END IF;

  IF to_regclass('public.admin_pin_sessions') IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.admin_pin_sessions s
    WHERE s.user_id = v_uid
      AND s.verified_until > now()
  ) INTO v_pin_verified;

  RETURN COALESCE(v_pin_verified, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── 3) Audit log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_id_idx
  ON public.admin_audit_log (actor_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_log FROM PUBLIC;
REVOKE ALL ON public.admin_audit_log FROM anon;
REVOKE ALL ON public.admin_audit_log FROM authenticated;

CREATE OR REPLACE FUNCTION public._admin_audit_log(
  p_action text,
  p_target_user_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_action IS NULL OR btrim(p_action) = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    btrim(p_action),
    p_target_user_id,
    COALESCE(p_details, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._admin_audit_log(text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_audit_log(text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._admin_audit_log(text, uuid, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_log_recent(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  action text,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin med aktiv PIN-session';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));

  RETURN QUERY
  SELECT
    l.id,
    l.actor_id,
    l.action,
    l.target_user_id,
    l.details,
    l.created_at
  FROM public.admin_audit_log l
  ORDER BY l.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_log_recent(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_audit_log_recent(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_audit_log_recent(integer) TO authenticated;

-- ─── 4) PIN-session 30 / 60 ─────────────────────────────────────────────────
--  inkluderet i samme migrationsfil via deploy-script)

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

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_target_email text;
  v_target_role text;
  v_mids uuid[];
  v_deleted_matches integer := 0;
  v_pin_check jsonb;
  v_pin_ok boolean := false;
  v_pin_reason text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF NOT public.has_admin_role() THEN
    RETURN jsonb_build_object('error', 'Kun admin kan slette spillere');
  END IF;

  -- Ekstra sikkerhed: kræv frisk PIN-verificering ved hver sletning.
  v_pin_check := public.admin_verify_pin(p_pin, 5);
  v_pin_ok := COALESCE((v_pin_check->>'ok')::boolean, false);
  IF NOT v_pin_ok THEN
    v_pin_reason := COALESCE(v_pin_check->>'reason', 'invalid');
    IF v_pin_reason = 'locked' THEN
      RETURN jsonb_build_object(
        'error',
        'For mange forkerte kodeforsøg. Prøv igen senere.',
        'reason',
        'locked',
        'locked_until',
        v_pin_check->>'locked_until'
      );
    END IF;
    RETURN jsonb_build_object('error', 'Forkert eller manglende admin-kode');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler user_id');
  END IF;

  IF p_user_id = v_actor_id THEN
    RETURN jsonb_build_object('error', 'Du kan ikke slette din egen admin-konto');
  END IF;

  SELECT u.email
    INTO v_target_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_target_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Bruger findes ikke i auth.users');
  END IF;

  SELECT p.role
    INTO v_target_role
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF COALESCE(v_target_role, '') = 'admin' THEN
    RETURN jsonb_build_object('error', 'Admin-konti kan ikke slettes via denne handling');
  END IF;

  -- Liga: undgå FK-blokering fra reported_by (hvis tabellen findes)
  IF to_regclass('public.league_matches') IS NOT NULL THEN
    EXECUTE 'UPDATE public.league_matches SET reported_by = NULL WHERE reported_by = $1'
    USING p_user_id;
  END IF;

  -- Saml alle 2v2-kampe hvor brugeren er opretter eller deltager
  IF to_regclass('public.matches') IS NOT NULL
     AND to_regclass('public.match_players') IS NOT NULL THEN
    EXECUTE $SQL$
      SELECT array_agg(DISTINCT m)::uuid[]
      FROM (
        SELECT id AS m
        FROM public.matches
        WHERE creator_id = $1
