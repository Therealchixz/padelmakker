-- =============================================================================
-- Growth campaign: Første 200 (lodtrækning ved fuld profil + bekræftet telefon)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.growth_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  prize_description text NOT NULL DEFAULT '',
  max_entries integer NOT NULL CHECK (max_entries > 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  draw_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'drawn')),
  rules_version text NOT NULL DEFAULT '1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growth_campaign_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.growth_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_number integer NOT NULL CHECK (entry_number > 0),
  qualified_at timestamptz NOT NULL DEFAULT now(),
  campaign_consent_at timestamptz,
  UNIQUE (campaign_id, user_id),
  UNIQUE (campaign_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_growth_campaign_entries_campaign
  ON public.growth_campaign_entries (campaign_id, entry_number);

CREATE INDEX IF NOT EXISTS idx_growth_campaign_entries_user
  ON public.growth_campaign_entries (user_id);

ALTER TABLE public.growth_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_campaign_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_campaigns_public_read ON public.growth_campaigns;
CREATE POLICY growth_campaigns_public_read ON public.growth_campaigns
  FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'closed', 'drawn'));

DROP POLICY IF EXISTS growth_campaign_entries_own_read ON public.growth_campaign_entries;
CREATE POLICY growth_campaign_entries_own_read ON public.growth_campaign_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS growth_campaign_entries_admin_all ON public.growth_campaign_entries;
CREATE POLICY growth_campaign_entries_admin_all ON public.growth_campaign_entries
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.growth_campaigns (slug, title, prize_description, max_entries, status, rules_version)
VALUES (
  'first_200',
  'Første 200',
  'Padel-pakke med bolde og greb (præcis indhold annonceres ved lodtrækning)',
  200,
  'active',
  '1'
)
ON CONFLICT (slug) DO NOTHING;

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
  v_exempt boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR COALESCE(v_profile.is_banned, false) THEN
    RETURN false;
  END IF;

  SELECT u.phone_confirmed_at INTO v_phone_confirmed
  FROM auth.users u
  WHERE u.id = p_user_id;

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

  IF COALESCE(array_length(v_profile.availability, 1), 0) = 0 THEN
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

CREATE OR REPLACE FUNCTION public.get_growth_campaign_public(p_slug text DEFAULT 'first_200')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_campaign public.growth_campaigns%ROWTYPE;
  v_taken integer;
BEGIN
  SELECT * INTO v_campaign
  FROM public.growth_campaigns
  WHERE slug = p_slug
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  RETURN json_build_object(
    'found', true,
    'slug', v_campaign.slug,
    'title', v_campaign.title,
    'prize_description', v_campaign.prize_description,
    'spots_taken', v_taken,
    'spots_total', v_campaign.max_entries,
    'is_open', v_campaign.status = 'active' AND v_taken < v_campaign.max_entries,
    'status', v_campaign.status,
    'rules_version', v_campaign.rules_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_growth_campaign_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_growth_campaign_public(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_growth_campaign_status(p_slug text DEFAULT 'first_200')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign public.growth_campaigns%ROWTYPE;
  v_entry public.growth_campaign_entries%ROWTYPE;
  v_taken integer;
  v_qualified boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('authenticated', false);
  END IF;

  SELECT * INTO v_campaign FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('authenticated', true, 'found', false);
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  SELECT * INTO v_entry
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id AND user_id = v_uid;

  v_qualified := public._growth_user_qualified(v_uid);

  RETURN json_build_object(
    'authenticated', true,
    'found', true,
    'slug', v_campaign.slug,
    'title', v_campaign.title,
    'prize_description', v_campaign.prize_description,
    'spots_taken', v_taken,
    'spots_total', v_campaign.max_entries,
    'is_open', v_campaign.status = 'active' AND v_taken < v_campaign.max_entries,
    'status', v_campaign.status,
    'qualified', v_qualified,
    'enrolled', v_entry.id IS NOT NULL,
    'entry_number', v_entry.entry_number,
    'campaign_full', v_taken >= v_campaign.max_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_growth_campaign_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_growth_campaign_status(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enroll_growth_campaign(
  p_slug text DEFAULT 'first_200',
  p_consent boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign public.growth_campaigns%ROWTYPE;
  v_existing public.growth_campaign_entries%ROWTYPE;
  v_taken integer;
  v_next integer;
  v_row public.growth_campaign_entries%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF COALESCE(p_consent, false) IS NOT TRUE THEN
    RETURN json_build_object('ok', false, 'error', 'consent_required');
  END IF;

  SELECT * INTO v_campaign FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_found');
  END IF;

  IF v_campaign.status <> 'active' THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_active');
  END IF;

  IF NOT public._growth_user_qualified(v_uid) THEN
    RETURN json_build_object('ok', false, 'error', 'not_qualified');
  END IF;

  SELECT * INTO v_existing
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id AND user_id = v_uid;

  IF FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'already_enrolled', true,
      'entry_number', v_existing.entry_number
    );
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  IF v_taken >= v_campaign.max_entries THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_full', 'spots_taken', v_taken);
  END IF;

  v_next := v_taken + 1;

  INSERT INTO public.growth_campaign_entries (campaign_id, user_id, entry_number, campaign_consent_at)
  VALUES (v_campaign.id, v_uid, v_next, now())
  ON CONFLICT (campaign_id, user_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.growth_campaign_entries
    WHERE campaign_id = v_campaign.id AND user_id = v_uid;
    RETURN json_build_object(
      'ok', true,
      'already_enrolled', true,
      'entry_number', v_existing.entry_number
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'already_enrolled', false,
    'entry_number', v_row.entry_number,
    'spots_taken', v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_growth_campaign(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_growth_campaign(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_growth_campaign_entries(p_slug text DEFAULT 'first_200')
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_campaign_id FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF v_campaign_id IS NULL THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(row_to_json(t) ORDER BY t.entry_number)
    FROM (
      SELECT
        e.entry_number,
        e.qualified_at,
        e.campaign_consent_at,
        e.user_id,
        p.full_name,
        p.name,
        p.area,
        p.created_at AS profile_created_at
      FROM public.growth_campaign_entries e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.campaign_id = v_campaign_id
      ORDER BY e.entry_number
    ) t
  ), '[]'::json);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_growth_campaign_entries(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_growth_campaign_entries(text) TO authenticated;

DO $$
DECLARE
  v_campaign_id uuid;
  v_max integer;
  v_existing integer;
BEGIN
  SELECT id, max_entries INTO v_campaign_id, v_max
  FROM public.growth_campaigns
  WHERE slug = 'first_200'
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_existing
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign_id;

  IF v_existing > 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.growth_campaign_entries (campaign_id, user_id, entry_number, campaign_consent_at)
  SELECT
    v_campaign_id,
    p.id,
    row_number() OVER (ORDER BY p.created_at ASC NULLS LAST, p.id ASC),
    now()
  FROM public.profiles p
  WHERE public._growth_user_qualified(p.id)
  ORDER BY p.created_at ASC NULLS LAST, p.id ASC
  LIMIT v_max;
END;
$$;
