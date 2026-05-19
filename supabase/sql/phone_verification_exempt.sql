-- Per-user undtagelse fra obligatorisk telefon-SMS (fx testkonti).
-- Admin kan sætte phone_verification_exempt = true i appen.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verification_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.phone_verification_exempt IS
  'When true, user may use the app without verified phone (admin-only).';

CREATE OR REPLACE FUNCTION public.admin_set_phone_verification_exempt(
  p_user_id uuid,
  p_exempt boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  SELECT p.role INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF COALESCE(v_actor_role, '') <> 'admin' THEN
    RETURN jsonb_build_object('error', 'Kun admin kan ændre telefon-undtagelse');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler user_id');
  END IF;

  UPDATE public.profiles
  SET phone_verification_exempt = COALESCE(p_exempt, false)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profil findes ikke');
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('phone_verification_exempt', COALESCE(p_exempt, false))
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'phone_verification_exempt', COALESCE(p_exempt, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_phone_verification_exempt(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_phone_verification_exempt(uuid, boolean) TO authenticated;
