-- Pulje-model: "Jeg vil spille" → automatisk kamp når fire passer sammen.
--
-- Baggrund: kun 4 personer har nogensinde oprettet en kamp, og 8 af 13 kampe
-- døde med opretteren alene. Byrden ved at organisere ligger hos brugeren.
--
-- Her vender vi det om. En bruger melder en lav-forpligtelses hensigt ("jeg kan
-- tirsdag 17-21"), og systemet samler fire overlappende hensigter til et
-- forslag. Bekræfter alle fire, oprettes kampen automatisk med hold fordelt.
--
-- Hensigter er bevidst dato-konkrete: en vag "søger makker"-tilstand kan ikke
-- omsættes til en kamp, men "tirsdag 17-21" kan.

CREATE TABLE IF NOT EXISTS public.play_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  play_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  region text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  level numeric,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'proposed', 'matched', 'cancelled', 'expired')),
  proposal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT play_intents_window_valid CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS play_intents_user_slot_uniq
  ON public.play_intents (user_id, play_date, start_time, end_time)
  WHERE status IN ('open', 'proposed');

CREATE INDEX IF NOT EXISTS play_intents_open_lookup
  ON public.play_intents (play_date, status);

CREATE TABLE IF NOT EXISTS public.match_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  region text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'expired')),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_proposals_pending
  ON public.match_proposals (status, expires_at);

CREATE TABLE IF NOT EXISTS public.match_proposal_members (
  proposal_id uuid NOT NULL REFERENCES public.match_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intent_id uuid REFERENCES public.play_intents(id) ON DELETE SET NULL,
  response text NOT NULL DEFAULT 'pending'
    CHECK (response IN ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  PRIMARY KEY (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS match_proposal_members_user
  ON public.match_proposal_members (user_id);

ALTER TABLE public.play_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_proposal_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS play_intents_select_own ON public.play_intents;
CREATE POLICY play_intents_select_own ON public.play_intents
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS match_proposals_select_member ON public.match_proposals;
CREATE POLICY match_proposals_select_member ON public.match_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_proposal_members m
    WHERE m.proposal_id = match_proposals.id
      AND m.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS match_proposal_members_select_member ON public.match_proposal_members;
CREATE POLICY match_proposal_members_select_member ON public.match_proposal_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.match_proposal_members mine
    WHERE mine.proposal_id = match_proposal_members.proposal_id
      AND mine.user_id = (SELECT auth.uid())
  ));

-- Skrivning sker udelukkende gennem RPC'erne nedenfor.
REVOKE INSERT, UPDATE, DELETE ON public.play_intents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_proposals FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.match_proposal_members FROM authenticated;
GRANT SELECT ON public.play_intents TO authenticated;
GRANT SELECT ON public.match_proposals TO authenticated;
GRANT SELECT ON public.match_proposal_members TO authenticated;

/**
 * Forsøg at danne et forslag omkring en hensigt.
 *
 * Kandidater skal overlappe seed'en i tid, ligge inden for radius af *alle*
 * allerede valgte (ikke kun seed'en, ellers kan yderpunkterne ligge dobbelt så
 * langt fra hinanden) og være niveaumæssigt tætte. Er der ikke fire i alt,
 * sker der ingenting — hensigten bliver blot liggende i puljen.
 */
CREATE OR REPLACE FUNCTION public.try_form_match_proposal(p_seed_intent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_seed public.play_intents%ROWTYPE;
  v_row record;
  v_sel_ids uuid[] := '{}';
  v_sel_users uuid[] := '{}';
  v_sel_lat double precision[] := '{}';
  v_sel_lon double precision[] := '{}';
  v_start time;
  v_end time;
  v_cand_start time;
  v_cand_end time;
  v_ok boolean;
  v_i integer;
  v_km double precision;
  v_proposal_id uuid;
  v_expires timestamptz;
  v_title text;
  v_body text;
  v_uid uuid;
  v_radius_km constant double precision := 40;
  v_min_overlap constant interval := interval '90 minutes';
  v_level_tol constant numeric := 1.2;
  v_needed constant integer := 4;
BEGIN
  SELECT * INTO v_seed FROM public.play_intents WHERE id = p_seed_intent_id;
  IF NOT FOUND OR v_seed.status <> 'open' THEN
    RETURN jsonb_build_object('ok', true, 'formed', false, 'reason', 'seed_unavailable');
  END IF;

  v_sel_ids := ARRAY[v_seed.id];
  v_sel_users := ARRAY[v_seed.user_id];
  v_sel_lat := ARRAY[v_seed.latitude];
  v_sel_lon := ARRAY[v_seed.longitude];
  v_start := v_seed.start_time;
  v_end := v_seed.end_time;

  FOR v_row IN
    SELECT i.*
    FROM public.play_intents i
    JOIN public.profiles p ON p.id = i.user_id
    WHERE i.status = 'open'
      AND i.play_date = v_seed.play_date
      AND i.user_id <> v_seed.user_id
      AND COALESCE(p.is_banned, false) = false
      AND i.start_time < v_seed.end_time
      AND i.end_time > v_seed.start_time
      AND (
        v_seed.level IS NULL OR i.level IS NULL
        OR abs(i.level - v_seed.level) <= v_level_tol
      )
      AND (
        (i.latitude IS NOT NULL AND v_seed.latitude IS NOT NULL)
        OR (v_seed.region <> '' AND i.region = v_seed.region)
      )
    ORDER BY i.created_at
  LOOP
    EXIT WHEN array_length(v_sel_ids, 1) >= v_needed;

    -- Undgå to hensigter fra samme bruger i ét forslag.
    IF v_row.user_id = ANY (v_sel_users) THEN
      CONTINUE;
    END IF;

    v_cand_start := GREATEST(v_start, v_row.start_time);
    v_cand_end := LEAST(v_end, v_row.end_time);
    IF (v_cand_end - v_cand_start) < v_min_overlap THEN
      CONTINUE;
    END IF;

    v_ok := true;
    FOR v_i IN 1 .. array_length(v_sel_ids, 1) LOOP
      IF v_sel_lat[v_i] IS NULL OR v_row.latitude IS NULL THEN
        CONTINUE; -- uden koordinater bærer region-kravet filtreringen
      END IF;
      v_km := public.haversine_km(v_sel_lat[v_i], v_sel_lon[v_i], v_row.latitude, v_row.longitude);
      IF v_km > v_radius_km THEN
        v_ok := false;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_ok THEN
      CONTINUE;
    END IF;

    v_sel_ids := array_append(v_sel_ids, v_row.id);
    v_sel_users := array_append(v_sel_users, v_row.user_id);
    v_sel_lat := array_append(v_sel_lat, v_row.latitude);
    v_sel_lon := array_append(v_sel_lon, v_row.longitude);
    v_start := v_cand_start;
    v_end := v_cand_end;
  END LOOP;

  IF array_length(v_sel_ids, 1) < v_needed THEN
    RETURN jsonb_build_object(
      'ok', true,
      'formed', false,
      'reason', 'not_enough',
      'pool_size', array_length(v_sel_ids, 1)
    );
  END IF;

  -- Bekræftelsesfrist: et døgn, men altid mindst to timer før spilletid. Ved
  -- kort varsel gives der stadig en halv time, så forslaget ikke fødes dødt.
  v_expires := LEAST(
    now() + interval '24 hours',
    ((v_seed.play_date + v_start) AT TIME ZONE 'Europe/Copenhagen') - interval '2 hours'
  );
  IF v_expires <= now() THEN
    v_expires := now() + interval '30 minutes';
  END IF;

  INSERT INTO public.match_proposals (play_date, start_time, end_time, region, expires_at)
  VALUES (v_seed.play_date, v_start, v_end, v_seed.region, v_expires)
  RETURNING id INTO v_proposal_id;

  INSERT INTO public.match_proposal_members (proposal_id, user_id, intent_id)
  SELECT v_proposal_id, i.user_id, i.id
  FROM public.play_intents i
  WHERE i.id = ANY (v_sel_ids);

  UPDATE public.play_intents
  SET status = 'proposed', proposal_id = v_proposal_id
  WHERE id = ANY (v_sel_ids);

  v_title := 'I er 4 — bekræft jeres kamp';
  v_body := format(
    '%s kl. %s-%s%s · Bekræft inden %s',
    to_char(v_seed.play_date, 'DD/MM'),
    to_char(v_start, 'HH24:MI'),
    to_char(v_end, 'HH24:MI'),
    CASE WHEN v_seed.region <> '' THEN ' · ' || v_seed.region ELSE '' END,
    to_char(v_expires AT TIME ZONE 'Europe/Copenhagen', 'DD/MM HH24:MI')
  );

  FOREACH v_uid IN ARRAY v_sel_users LOOP
    INSERT INTO public.notifications
      (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES
      (v_uid, 'match_proposal', v_title, v_body, NULL, 'match_proposal', v_proposal_id, false);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'formed', true,
    'proposal_id', v_proposal_id,
    'play_date', v_seed.play_date,
    'start_time', to_char(v_start, 'HH24:MI'),
    'end_time', to_char(v_end, 'HH24:MI'),
    'member_ids', to_jsonb(v_sel_users)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.try_form_match_proposal(uuid) FROM PUBLIC;

/**
 * Meld dig klar i et konkret tidsrum. Forsøger straks at danne et forslag, så
 * brugeren får svar med det samme i stedet for bare en bekræftelse.
 */
CREATE OR REPLACE FUNCTION public.create_play_intent(
  p_play_date date,
  p_start_time time,
  p_end_time time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_intent_id uuid;
  v_form jsonb;
  v_pool integer;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  IF p_play_date IS NULL OR p_start_time IS NULL OR p_end_time IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Udfyld dato og tidsrum');
  END IF;

  IF p_end_time <= p_start_time THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sluttidspunkt skal være efter start');
  END IF;

  IF (p_end_time - p_start_time) < interval '90 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg mindst 1½ time, så der er plads til en kamp');
  END IF;

  IF p_play_date < (now() AT TIME ZONE 'Europe/Copenhagen')::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vælg en dato i fremtiden');
  END IF;

  IF p_play_date > ((now() AT TIME ZONE 'Europe/Copenhagen')::date + 30) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Du kan melde dig klar op til 30 dage frem');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil findes ikke');
  END IF;

  IF COALESCE(v_profile.is_banned, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Din profil er spærret');
  END IF;

  INSERT INTO public.play_intents
    (user_id, play_date, start_time, end_time, region, latitude, longitude, level)
  VALUES (
    v_caller,
    p_play_date,
    p_start_time,
    p_end_time,
    public.canonical_app_region(v_profile.area),
    v_profile.latitude,
    v_profile.longitude,
    -- profiles.level er `real`; uden cast kan Postgres ikke slå funktionen op.
    public.match_filter_prefs_level('{}'::jsonb, v_profile.level::numeric)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_intent_id;

  IF v_intent_id IS NULL THEN
    SELECT id INTO v_intent_id
    FROM public.play_intents
    WHERE user_id = v_caller
      AND play_date = p_play_date
      AND start_time = p_start_time
      AND end_time = p_end_time
      AND status IN ('open', 'proposed')
    LIMIT 1;
  END IF;

  v_form := public.try_form_match_proposal(v_intent_id);

  -- Hvor mange andre står klar i samme slot? Bruges til øjeblikkelig feedback.
  SELECT COUNT(*) INTO v_pool
  FROM public.play_intents i
  WHERE i.status = 'open'
    AND i.play_date = p_play_date
    AND i.user_id <> v_caller
    AND i.start_time < p_end_time
    AND i.end_time > p_start_time;

  RETURN jsonb_build_object(
    'ok', true,
    'intent_id', v_intent_id,
    'others_waiting', v_pool,
    'proposal', v_form
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_play_intent(date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_play_intent(date, time, time) TO authenticated;

/**
 * Svar på et forslag. Når alle fire har sagt ja, oprettes kampen automatisk
 * med to spillere på hvert hold, og alle får besked.
 */
CREATE OR REPLACE FUNCTION public.respond_to_match_proposal(
  p_proposal_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_proposal public.match_proposals%ROWTYPE;
  v_pending integer;
  v_match_id uuid;
  v_row record;
  v_team integer := 1;
  v_seat integer := 0;
  v_title text;
  v_body text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_proposal
  FROM public.match_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forslaget findes ikke');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_proposal_members
    WHERE proposal_id = p_proposal_id AND user_id = v_caller
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Du er ikke med i dette forslag');
  END IF;

  IF v_proposal.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_proposal.status, 'match_id', v_proposal.match_id);
  END IF;

  IF v_proposal.expires_at <= now() THEN
    UPDATE public.match_proposals SET status = 'expired' WHERE id = p_proposal_id;
    UPDATE public.play_intents SET status = 'expired'
    WHERE proposal_id = p_proposal_id AND status = 'proposed';
    RETURN jsonb_build_object('ok', true, 'status', 'expired');
  END IF;

  UPDATE public.match_proposal_members
  SET response = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE proposal_id = p_proposal_id AND user_id = v_caller;

  IF NOT p_accept THEN
    UPDATE public.match_proposals SET status = 'declined' WHERE id = p_proposal_id;

    -- Den der sagde nej trækkes ud; de øvrige ryger tilbage i puljen.
    UPDATE public.play_intents SET status = 'cancelled', proposal_id = NULL
    WHERE proposal_id = p_proposal_id AND user_id = v_caller;

    UPDATE public.play_intents SET status = 'open', proposal_id = NULL
    WHERE proposal_id = p_proposal_id AND status = 'proposed';

    INSERT INTO public.notifications
      (user_id, type, title, body, match_id, entity_type, entity_id, read)
    SELECT m.user_id,
           'match_proposal_declined',
           'Kampen blev ikke til noget',
           'En spiller kunne ikke alligevel. Du står stadig klar i puljen.',
           NULL, 'match_proposal', p_proposal_id, false
    FROM public.match_proposal_members m
    WHERE m.proposal_id = p_proposal_id AND m.user_id <> v_caller;

    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  SELECT COUNT(*) INTO v_pending
  FROM public.match_proposal_members
  WHERE proposal_id = p_proposal_id AND response <> 'accepted';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', true, 'status', 'pending', 'awaiting', v_pending);
  END IF;

  INSERT INTO public.matches (creator_id, date, "time", time_end, status, max_players, current_players, description)
  VALUES (
    (SELECT user_id FROM public.match_proposal_members
      WHERE proposal_id = p_proposal_id ORDER BY responded_at NULLS LAST LIMIT 1),
    v_proposal.play_date,
    to_char(v_proposal.start_time, 'HH24:MI'),
    to_char(v_proposal.end_time, 'HH24:MI'),
    'full',
    4,
    4,
    'Samlet automatisk af PadelMakker — husk at booke bane'
  )
  RETURNING id INTO v_match_id;

  FOR v_row IN
    SELECT m.user_id,
           COALESCE(NULLIF(btrim(p.full_name), ''), NULLIF(btrim(p.name), ''), 'Spiller') AS navn,
           COALESCE(NULLIF(btrim(p.avatar_emoji), ''), '🎾') AS emoji
    FROM public.match_proposal_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.proposal_id = p_proposal_id
    ORDER BY m.responded_at NULLS LAST, m.user_id
  LOOP
    v_team := CASE WHEN v_seat < 2 THEN 1 ELSE 2 END;
    INSERT INTO public.match_players (match_id, user_id, user_name, user_emoji, team)
    VALUES (v_match_id, v_row.user_id, v_row.navn, v_row.emoji, v_team);
    v_seat := v_seat + 1;
  END LOOP;

  UPDATE public.match_proposals
  SET status = 'confirmed', match_id = v_match_id
  WHERE id = p_proposal_id;

  UPDATE public.play_intents SET status = 'matched'
  WHERE proposal_id = p_proposal_id;

  v_title := 'Kampen er booket ind';
  v_body := format(
    'Alle fire har bekræftet %s kl. %s. Aftal bane i chatten.',
    to_char(v_proposal.play_date, 'DD/MM'),
    to_char(v_proposal.start_time, 'HH24:MI')
  );

  INSERT INTO public.notifications
    (user_id, type, title, body, match_id, entity_type, entity_id, read)
  SELECT m.user_id, 'match_proposal_confirmed', v_title, v_body, v_match_id, 'match', v_match_id, false
  FROM public.match_proposal_members m
  WHERE m.proposal_id = p_proposal_id;

  RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'match_id', v_match_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_match_proposal(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_match_proposal(uuid, boolean) TO authenticated;

/** Træk din hensigt tilbage. */
CREATE OR REPLACE FUNCTION public.cancel_play_intent(p_intent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_intent public.play_intents%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_intent FROM public.play_intents WHERE id = p_intent_id;
  IF NOT FOUND OR v_intent.user_id <> v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hensigten findes ikke');
  END IF;

  IF v_intent.status = 'proposed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Svar på forslaget i stedet');
  END IF;

  UPDATE public.play_intents SET status = 'cancelled' WHERE id = p_intent_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_play_intent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_play_intent(uuid) TO authenticated;

/** Oprydning: udløbne forslag frigiver deres hensigter igen. */
CREATE OR REPLACE FUNCTION public.expire_stale_play_intents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_proposals integer := 0;
  v_intents integer := 0;
BEGIN
  WITH stale AS (
    UPDATE public.match_proposals
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_proposals FROM stale;

  UPDATE public.play_intents i
  SET status = 'open', proposal_id = NULL
  WHERE i.status = 'proposed'
    AND EXISTS (
      SELECT 1 FROM public.match_proposals p
      WHERE p.id = i.proposal_id AND p.status = 'expired'
    );

  WITH gone AS (
    UPDATE public.play_intents
    SET status = 'expired'
    WHERE status = 'open'
      AND play_date < (now() AT TIME ZONE 'Europe/Copenhagen')::date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_intents FROM gone;

  RETURN jsonb_build_object('ok', true, 'proposals_expired', v_proposals, 'intents_expired', v_intents);
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_stale_play_intents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_play_intents() TO authenticated;
