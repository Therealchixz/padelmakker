-- Admin lodtrækning for Første 200-kampagne

ALTER TABLE public.growth_campaigns
  ADD COLUMN IF NOT EXISTS winner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_entry_number integer CHECK (winner_entry_number IS NULL OR winner_entry_number > 0),
  ADD COLUMN IF NOT EXISTS drawn_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_growth_campaigns_winner
  ON public.growth_campaigns (winner_user_id)
  WHERE winner_user_id IS NOT NULL;

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
    'is_open', v_campaign.status = 'active' AND v_taken < v_campaign.max_entries AND v_campaign.winner_user_id IS NULL,
    'status', v_campaign.status,
    'rules_version', v_campaign.rules_version,
    'draw_completed', v_campaign.winner_user_id IS NOT NULL,
    'draw_at', v_campaign.draw_at
  );
END;
$$;

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
    'is_open', v_campaign.status = 'active' AND v_taken < v_campaign.max_entries AND v_campaign.winner_user_id IS NULL,
    'status', v_campaign.status,
    'qualified', v_qualified,
    'enrolled', v_entry.id IS NOT NULL,
    'entry_number', v_entry.entry_number,
    'campaign_full', v_taken >= v_campaign.max_entries,
    'draw_completed', v_campaign.winner_user_id IS NOT NULL,
    'is_winner', v_campaign.winner_user_id IS NOT NULL AND v_campaign.winner_user_id = v_uid
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_growth_campaign_draw_status(p_slug text DEFAULT 'first_200')
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
  v_winner_name text;
  v_drawn_by_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_campaign FROM public.growth_campaigns WHERE slug = p_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  IF v_campaign.winner_user_id IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Spiller')
    INTO v_winner_name
    FROM public.profiles p
    WHERE p.id = v_campaign.winner_user_id;
  END IF;

  IF v_campaign.drawn_by IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Admin')
    INTO v_drawn_by_name
    FROM public.profiles p
    WHERE p.id = v_campaign.drawn_by;
  END IF;

  RETURN json_build_object(
    'found', true,
    'slug', v_campaign.slug,
    'title', v_campaign.title,
    'spots_taken', v_taken,
    'spots_total', v_campaign.max_entries,
    'status', v_campaign.status,
    'can_draw', v_campaign.winner_user_id IS NULL AND v_taken > 0,
    'is_full', v_taken >= v_campaign.max_entries,
    'draw_completed', v_campaign.winner_user_id IS NOT NULL,
    'draw_at', v_campaign.draw_at,
    'winner_user_id', v_campaign.winner_user_id,
    'winner_entry_number', v_campaign.winner_entry_number,
    'winner_name', v_winner_name,
    'drawn_by_name', v_drawn_by_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_growth_campaign_draw_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_growth_campaign_draw_status(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_draw_growth_campaign(
  p_slug text DEFAULT 'first_200',
  p_allow_partial boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_campaign public.growth_campaigns%ROWTYPE;
  v_entry public.growth_campaign_entries%ROWTYPE;
  v_winner_name text;
  v_taken integer;
  v_prize text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_campaign
  FROM public.growth_campaigns
  WHERE slug = p_slug
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_found');
  END IF;

  IF v_campaign.winner_user_id IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Spiller')
    INTO v_winner_name
    FROM public.profiles p
    WHERE p.id = v_campaign.winner_user_id;

    RETURN json_build_object(
      'ok', true,
      'already_drawn', true,
      'winner_user_id', v_campaign.winner_user_id,
      'winner_entry_number', v_campaign.winner_entry_number,
      'winner_name', v_winner_name,
      'draw_at', v_campaign.draw_at
    );
  END IF;

  SELECT count(*)::int INTO v_taken
  FROM public.growth_campaign_entries
  WHERE campaign_id = v_campaign.id;

  IF v_taken <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'no_entries');
  END IF;

  IF v_taken < v_campaign.max_entries AND NOT COALESCE(p_allow_partial, false) THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'campaign_not_full',
      'spots_taken', v_taken,
      'spots_total', v_campaign.max_entries
    );
  END IF;

  SELECT e.* INTO v_entry
  FROM public.growth_campaign_entries e
  WHERE e.campaign_id = v_campaign.id
  ORDER BY random()
  LIMIT 1;

  SELECT coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.name), ''), 'Spiller')
  INTO v_winner_name
  FROM public.profiles p
  WHERE p.id = v_entry.user_id;

  v_prize := coalesce(nullif(trim(v_campaign.prize_description), ''), 'Padel-præmie');

  UPDATE public.growth_campaigns
  SET
    winner_user_id = v_entry.user_id,
    winner_entry_number = v_entry.entry_number,
    drawn_by = v_admin,
    draw_at = now(),
    status = 'drawn',
    updated_at = now()
  WHERE id = v_campaign.id;

  INSERT INTO public.notifications (user_id, type, title, body, read)
  VALUES (
    v_entry.user_id,
    'growth_campaign_winner',
    'Tillykke — du har vundet Første 200! 🎁',
    'Du er trukket som vinder af lodtrækningen (lod #' || v_entry.entry_number || '). Vi kontakter dig snart om ' || v_prize || '.',
    false
  );

  IF to_regprocedure('public._admin_audit_log(text,uuid,jsonb)') IS NOT NULL THEN
    PERFORM public._admin_audit_log(
      'growth_campaign_draw',
      v_entry.user_id,
      jsonb_build_object(
        'slug', p_slug,
        'entry_number', v_entry.entry_number,
        'spots_taken', v_taken,
        'allow_partial', COALESCE(p_allow_partial, false)
      )
    );
  END IF;

  RETURN json_build_object(
    'ok', true,
    'already_drawn', false,
    'winner_user_id', v_entry.user_id,
    'winner_entry_number', v_entry.entry_number,
    'winner_name', v_winner_name,
    'draw_at', now(),
    'spots_taken', v_taken
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_draw_growth_campaign(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_draw_growth_campaign(text, boolean) TO authenticated;
