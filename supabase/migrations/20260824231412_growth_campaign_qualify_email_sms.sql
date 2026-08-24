-- Lodtrækning: bekræftet e-mail + SMS og udfyldt profil. Spilledag/tidsrum er ikke et krav.

CREATE OR REPLACE FUNCTION public._growth_user_qualified(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_phone_confirmed timestamptz;
  v_email_confirmed timestamptz;
  v_exempt boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR COALESCE(v_profile.is_banned, false) THEN
    RETURN false;
  END IF;

  SELECT u.phone_confirmed_at, u.email_confirmed_at
    INTO v_phone_confirmed, v_email_confirmed
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_email_confirmed IS NULL THEN
    RETURN false;
  END IF;

  v_exempt := COALESCE(v_profile.phone_verification_exempt, false);

  IF v_phone_confirmed IS NULL AND NOT v_exempt THEN
    RETURN false;
  END IF;

  IF v_profile.birth_year IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(trim(v_profile.play_style), '') IN ('', 'Ved ikke endnu') THEN
    RETURN false;
  END IF;

  IF COALESCE(trim(v_profile.full_name), '') = ''
     OR lower(trim(v_profile.full_name)) IN ('ny spiller', 'ny', 'spiller') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public._growth_user_qualified(uuid) FROM PUBLIC;

UPDATE public.growth_campaigns
SET rules_version = '2', updated_at = now()
WHERE slug = 'first_200';

WITH campaign AS (
  SELECT id, max_entries
  FROM public.growth_campaigns
  WHERE slug = 'first_200' AND status = 'active'
  LIMIT 1
),
taken AS (
  SELECT
    coalesce(max(e.entry_number), 0) AS mx,
    count(*)::int AS n
  FROM public.growth_campaign_entries e
  JOIN campaign c ON c.id = e.campaign_id
),
candidates AS (
  SELECT
    p.id,
    row_number() OVER (ORDER BY p.created_at ASC NULLS LAST, p.id ASC) AS rn
  FROM public.profiles p
  CROSS JOIN campaign c
  WHERE public._growth_user_qualified(p.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.growth_campaign_entries e
      WHERE e.campaign_id = c.id AND e.user_id = p.id
    )
)
INSERT INTO public.growth_campaign_entries (campaign_id, user_id, entry_number, campaign_consent_at)
SELECT c.id, cand.id, t.mx + cand.rn, now()
FROM candidates cand
CROSS JOIN campaign c
CROSS JOIN taken t
WHERE t.n + cand.rn <= c.max_entries;
