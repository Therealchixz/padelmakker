-- Migration 20260520091905_phone_exempt_skip_onboarding
-- Backfilled from sql:phone_exempt_skip_onboarding.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Når admin undtager fra SMS: markér at telefon ikke kræves (metadata til Auth).
-- Eksisterende undtagne brugere med udfyldt profil: sæt onboarding_completed så de ikke sendes til /opret igen.

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
  v_meta_patch jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Kun admin med verificeret PIN kan ændre telefon-undtagelse');
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

  v_meta_patch := jsonb_build_object('phone_verification_exempt', COALESCE(p_exempt, false));
  IF COALESCE(p_exempt, false) THEN
    v_meta_patch := v_meta_patch || jsonb_build_object('phone_verification_required', false);
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || v_meta_patch
  WHERE id = p_user_id;

  PERFORM public._admin_audit_log(
    'phone_verification_exempt',
    p_user_id,
    jsonb_build_object('exempt', COALESCE(p_exempt, false))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'phone_verification_exempt', COALESCE(p_exempt, false)
  );
END;
$$;

-- Brugere der allerede er undtaget og har område + tilgængelighed (fx fast ved telefon-trin)
UPDATE auth.users u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'phone_verification_required', false,
    'onboarding_completed', true
  )
FROM public.profiles p
WHERE p.id = u.id
  AND p.phone_verification_exempt = true
  AND COALESCE(trim(p.full_name), trim(p.name), '') <> ''
  AND trim(COALESCE(p.full_name, p.name, '')) NOT IN ('Ny spiller', 'Ny', 'Spiller')
  AND (
    (COALESCE(array_length(p.availability, 1), 0) > 0 AND COALESCE(trim(p.area), trim(p.city), '') <> '')
    OR (
      p.birth_year IS NOT NULL
      AND COALESCE(trim(p.play_style), '') <> ''
      AND trim(p.play_style) <> 'Ved ikke endnu'
    )
  );

NOTIFY pgrst, 'reload schema';
