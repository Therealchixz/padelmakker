-- Migration 20260519194754_admin_americano_pin_auth
-- Backfilled from sql:recovered/admin_americano_pin_auth.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Americano admin-handlinger kræver PIN-verificeret admin (is_admin / is_user_admin_verified).

CREATE OR REPLACE FUNCTION public.has_valid_match_result_confirmation(
  p_match_id uuid,
  p_submitted_by uuid,
  p_confirmed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $confirm_guard$
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_user_admin_verified(p_confirmed_by) THEN
    RETURN true;
  END IF;

  RETURN public.can_confirm_match_result(p_match_id, p_submitted_by, p_confirmed_by);
END;
$confirm_guard$;

DROP POLICY IF EXISTS "americano_participants_admin_delete" ON public.americano_participants;
CREATE POLICY "americano_participants_admin_delete"
  ON public.americano_participants
  FOR DELETE TO authenticated
  USING (public.is_admin());
