-- Migration 20260520085148_user_phone_verification_exempt_rpc
-- Backfilled from sql:user_phone_verification_exempt_rpc.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Læs egen telefon-SMS-undtagelse (kun DB — kan ikke forfalskes via user_metadata).

CREATE OR REPLACE FUNCTION public.user_is_phone_verification_exempt()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.phone_verification_exempt
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_phone_verification_exempt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_phone_verification_exempt() TO authenticated;

NOTIFY pgrst, 'reload schema';
