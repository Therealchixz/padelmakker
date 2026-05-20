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
