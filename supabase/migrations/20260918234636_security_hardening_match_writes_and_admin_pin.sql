-- Sikkerhedshærdning efter fuld gennemgang af app, database og edge functions.
--
-- 1) match_players: direkte UPDATE fra klienten lukkes helt. INSERT var allerede
--    RPC-only (policy with_check=false), men UPDATE-grantet omfattede match_id,
--    så en bruger kunne flytte sin egen række over i en vilkårlig kamp og dermed
--    omgå join_open_match (ban-tjek, rate limit, holdkapacitet, lukkede kampe)
--    og enforce_max_players (der kun er BEFORE INSERT).
--    Hold og banehalvdel sættes i forvejen udelukkende via de SECURITY DEFINER-
--    RPC'er set_match_player_team / set_match_player_court_side.
--
-- 2) matches: UPDATE-grantet omfattede bl.a. creator_id, så enhver deltager
--    kunne overtage kampen. Grantet snævres ind til de felter klienten faktisk
--    skriver, og en trigger håndhæver resten.
--
-- 3) can_confirm_match_result: holdet blev slået op i match_players LIVE. En
--    spiller kunne indsende et resultat, skifte eget hold og lade sin makker
--    bekræfte det. Holdet læses nu fra det uforanderlige snapshot på
--    match_results-rækken.
--
-- 4) admin_setup_pin: kunne overskrive en eksisterende PIN uden at kende den,
--    hvilket satte hele PIN-gaten ud af kraft ved et kompromitteret admin-JWT.
--
-- 5) Interne SECURITY DEFINER-funktioner havde stadig EXECUTE for `authenticated`
--    (migration 20260729142616 revokede kun fra PUBLIC og anon).
--
-- 6) Legacy join_match uden ban-tjek/rate limit revokes.
--
-- 7) enroll_growth_campaign: race på entry_number uden lås på kampagnerækken.


-- ─── 1) match_players: ingen direkte UPDATE fra klienten ─────────────────────
REVOKE UPDATE ON public.match_players FROM anon, authenticated;

DROP POLICY IF EXISTS match_players_update_own_team ON public.match_players;
DROP POLICY IF EXISTS match_players_update_via_rpc_only ON public.match_players;
CREATE POLICY match_players_update_via_rpc_only
  ON public.match_players
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY match_players_update_via_rpc_only ON public.match_players IS
  'Hold og banehalvdel ændres kun via set_match_player_team / set_match_player_court_side (SECURITY DEFINER), som håndhæver kampstatus og ejerskab.';

-- ─── 2) matches: kun de felter klienten faktisk skriver ──────────────────────
REVOKE UPDATE ON public.matches FROM anon, authenticated;
GRANT UPDATE (
  status,
  started_at,
  started_by,
  current_players,
  seeking_player,
  seeking_player_notified_at
) ON public.matches TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_matches_client_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- SECURITY DEFINER-funktioner kører som ejeren og skal kunne alt.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.creator_id IS DISTINCT FROM OLD.creator_id THEN
    RAISE EXCEPTION 'Kampens opretter kan ikke ændres';
  END IF;

  -- En afsluttet kamp har fået ELO tildelt og er lukket for klient-skrivninger.
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Afsluttet kamp kan ikke ændres';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('completed', 'cancelled')
     AND auth.uid() IS DISTINCT FROM OLD.creator_id THEN
    RAISE EXCEPTION 'Kun kampens opretter kan afslutte eller aflyse kampen';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_matches_client_update ON public.matches;
CREATE TRIGGER trg_guard_matches_client_update
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_matches_client_update();

REVOKE EXECUTE ON FUNCTION public.guard_matches_client_update() FROM PUBLIC, anon, authenticated;

-- ─── 3) Resultatbekræftelse ud fra snapshot, ikke live match_players ─────────
CREATE OR REPLACE FUNCTION public.can_confirm_match_result(
  p_match_id uuid,
  p_submitted_by uuid,
  p_confirmed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_mr public.match_results%ROWTYPE;
  v_submitter_team integer;
  v_confirmer_team integer;
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN
    RETURN false;
  END IF;

  -- Holdopstillingen låses fast på resultatrækken ved indsendelse. Den må ikke
  -- læses fra match_players, som spillerne selv kan ændre bagefter.
  SELECT *
  INTO v_mr
  FROM public.match_results mr
  WHERE mr.match_id = p_match_id
    AND mr.submitted_by IS NOT DISTINCT FROM p_submitted_by
  ORDER BY mr.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND AND (
       v_mr.team1_player1_id IS NOT NULL
    OR v_mr.team1_player2_id IS NOT NULL
    OR v_mr.team2_player1_id IS NOT NULL
    OR v_mr.team2_player2_id IS NOT NULL
  ) THEN
    v_confirmer_team := CASE
      WHEN p_confirmed_by = v_mr.team1_player1_id
        OR p_confirmed_by = v_mr.team1_player2_id THEN 1
      WHEN p_confirmed_by = v_mr.team2_player1_id
        OR p_confirmed_by = v_mr.team2_player2_id THEN 2
      ELSE NULL
    END;

    -- Bekræfteren skal stå på resultatet.
    IF v_confirmer_team IS NULL THEN
      RETURN false;
    END IF;

    v_submitter_team := CASE
      WHEN p_submitted_by = v_mr.team1_player1_id
        OR p_submitted_by = v_mr.team1_player2_id THEN 1
      WHEN p_submitted_by = v_mr.team2_player1_id
        OR p_submitted_by = v_mr.team2_player2_id THEN 2
      ELSE NULL
    END;

    -- System-indsendte rækker er neutrale: enhver på resultatet må bekræfte.
    IF v_submitter_team IS NULL THEN
      RETURN true;
    END IF;

    RETURN v_submitter_team <> v_confirmer_team;
  END IF;

  -- Fallback for gamle rækker uden holdsnapshot.
  SELECT mp.team
  INTO v_confirmer_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_confirmed_by
  LIMIT 1;

  IF v_confirmer_team IS NULL THEN
    RETURN false;
  END IF;

  SELECT mp.team
  INTO v_submitter_team
  FROM public.match_players mp
  WHERE mp.match_id = p_match_id
    AND mp.user_id = p_submitted_by
  LIMIT 1;

  IF v_submitter_team IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_submitter_team <> v_confirmer_team;
END;
$function$;

-- ─── 4) Admin-PIN kan ikke nulstilles uden den nuværende kode ────────────────
CREATE OR REPLACE FUNCTION public.admin_setup_pin(p_pin text, p_remember_minutes integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_until timestamptz;
  v_minutes integer := GREATEST(5, LEAST(COALESCE(p_remember_minutes, 30), 60));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;
  IF NOT public.has_admin_role() THEN RAISE EXCEPTION 'Kun admins'; END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'PIN skal være præcis 6 tal'; END IF;

  -- Findes der allerede en kode, kræver ændring en aktiv PIN-session (is_admin()),
  -- så et stjålet admin-JWT ikke kan sætte en ny kode og dermed omgå PIN-gaten.
  IF EXISTS (SELECT 1 FROM public.admin_pin_settings s WHERE s.user_id = v_uid)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Der findes allerede en admin-kode. Lås op med den nuværende kode først.';
  END IF;

  INSERT INTO public.admin_pin_settings AS s (user_id, pin_hash, failed_attempts, lock_until, updated_at)
  VALUES (v_uid, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, failed_attempts = 0, lock_until = NULL, updated_at = now();

  v_until := now() + make_interval(mins => v_minutes);
  INSERT INTO public.admin_pin_sessions AS sess (user_id, verified_until, updated_at)
  VALUES (v_uid, v_until, now())
  ON CONFLICT (user_id) DO UPDATE SET verified_until = EXCLUDED.verified_until, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'verified_until', v_until);
END;
$function$;

-- ─── 5) Interne definer-funktioner: også væk fra `authenticated` ─────────────
-- Migration 20260729142616 revokede kun fra PUBLIC og anon, så rollen
-- `authenticated` havde stadig et eksplicit grant. _insert_system_notification
-- har hverken auth-tjek eller rate limit, og type='match_proposal' udløser
-- notifications_dispatch_match_proposal -> push med afsenderens egen tekst.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        '_insert_system_notification','_skip_duplicate_match_notification',
        '_skip_duplicate_entity_notification',
        'guard_americano_participant_insert','league_team_messages_set_league_id',
        'notify_auto_confirmed_match_result','notify_elo_changes_for_match',
        'match_players_fill_court_side'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ─── 6) Legacy- og cron-funktioner væk fra klientroller ─────────────────────
-- join_match er erstattet af join_open_match og mangler ban-tjek, rate limit og
-- holdkapacitetstjek. expire_stale_play_intents skal kun køres af cron, præcis
-- som kommentaren i 20260914210450 siger.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('join_match', 'expire_stale_play_intents')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ─── 7) Kampagnetilmelding: lås kampagnerækken før nummertildeling ──────────
CREATE OR REPLACE FUNCTION public.enroll_growth_campaign(p_slug text DEFAULT 'first_200'::text, p_consent boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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

  -- FOR UPDATE: uden låsen kan to samtidige tilmeldinger beregne det samme
  -- entry_number og ramme UNIQUE (campaign_id, entry_number) med en rå 500-fejl.
  SELECT * INTO v_campaign
  FROM public.growth_campaigns
  WHERE slug = p_slug
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'campaign_not_active');
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

  SELECT COALESCE(max(entry_number), 0)::int INTO v_taken
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
$function$;

