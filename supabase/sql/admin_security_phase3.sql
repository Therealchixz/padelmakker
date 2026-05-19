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

-- ─── 4) PIN + RPC-hårdning ──────────────────────────────────────────────────
-- Fuld deploy: kør admin_security_phase3_deploy.sql (samler PIN, RPC, audit).
