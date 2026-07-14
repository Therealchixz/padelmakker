-- Audit log for admin handlinger (slet bruger m.m.).

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
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_user_id, details)
  VALUES (auth.uid(), p_action, p_target_user_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public._admin_audit_log(text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_audit_log(text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._admin_audit_log(text, uuid, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_log_recent(p_limit integer DEFAULT 50)
RETURNS SETOF public.admin_audit_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin';
  END IF;

  RETURN QUERY
  SELECT l.*
  FROM public.admin_audit_log l
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_log_recent(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_audit_log_recent(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_audit_log_recent(integer) TO authenticated;
