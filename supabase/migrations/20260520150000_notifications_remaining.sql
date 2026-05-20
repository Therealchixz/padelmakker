-- Remaining notifications: prefs, auto-confirm notify, elo_change, drop old invite RPC

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "push": {
      "kampe": true,
      "resultat": true,
      "liga": true,
      "chat": true,
      "invitation": true,
      "system": true
    }
  }'::jsonb;

COMMENT ON COLUMN public.profiles.notification_prefs IS
  'Push kanal-toggles: kampe, resultat, liga, chat, invitation, system (admin inkl.).';

-- Dedup på match_id (resultat / elo)
CREATE OR REPLACE FUNCTION public._skip_duplicate_match_notification(
  p_user_id uuid,
  p_type text,
  p_match_id uuid,
  p_hours integer DEFAULT 24
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.type = p_type
      AND n.match_id = p_match_id
      AND n.created_at > now() - make_interval(hours => GREATEST(1, COALESCE(p_hours, 24)))
  );
$$;

CREATE OR REPLACE FUNCTION public._insert_system_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_et text := nullif(lower(trim(coalesce(p_entity_type, ''))), '');
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
  VALUES (p_user_id, p_type, p_title, p_body, p_match_id, v_et, p_entity_id, false);
END;
$$;

-- ELO-opdatering efter apply (seneste history-rækker for kampen)
CREATE OR REPLACE FUNCTION public.notify_elo_changes_for_match(p_match_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  IF p_match_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT eh.user_id, eh.change, eh.old_rating, eh.new_rating
    FROM public.elo_history eh
    WHERE eh.match_id = p_match_id
      AND eh.created_at > now() - interval '2 minutes'
  LOOP
    IF public._skip_duplicate_match_notification(v_row.user_id, 'elo_change', p_match_id, 24) THEN
      CONTINUE;
    END IF;
    PERFORM public._insert_system_notification(
      v_row.user_id,
      'elo_change',
      'ELO opdateret',
      format(
        '%s point (%s → %s). Se din profil eller kampen under Kampe.',
        CASE WHEN v_row.change >= 0 THEN '+' || v_row.change::text ELSE v_row.change::text END,
        v_row.old_rating,
        v_row.new_rating
      ),
      p_match_id,
      NULL,
      NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Auto-bekræft: underret alle spillere (én gang per kamp)
CREATE OR REPLACE FUNCTION public.notify_auto_confirmed_match_result(
  p_match_id uuid,
  p_score_text text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_player_id uuid;
  v_count integer := 0;
  v_body text;
BEGIN
  v_body := coalesce(nullif(trim(p_score_text), ''), 'Resultatet');
  v_body := v_body || ' — automatisk bekræftet efter 24 timer uden svar.';

  FOR v_player_id IN
    SELECT mp.user_id FROM public.match_players mp WHERE mp.match_id = p_match_id
  LOOP
    IF public._skip_duplicate_match_notification(v_player_id, 'result_confirmed', p_match_id, 24) THEN
      CONTINUE;
    END IF;
    PERFORM public._insert_system_notification(
      v_player_id,
      'result_confirmed',
      'Resultat bekræftet (auto)',
      v_body,
      p_match_id,
      NULL,
      NULL
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_confirm_expired_match_results()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_result match_results%ROWTYPE;
  v_submitter_team integer;
  v_opponent_id uuid;
  v_confirmed_count integer := 0;
  v_elo_applied_count integer := 0;
  v_skipped_count integer := 0;
  v_notified_count integer := 0;
  v_elo_result jsonb;
  v_score_text text;
BEGIN
  FOR v_result IN
    SELECT *
    FROM match_results
    WHERE confirmed = false
      AND created_at < now() - interval '24 hours'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT mp.team INTO v_submitter_team
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id = v_result.submitted_by
    LIMIT 1;

    SELECT mp.user_id INTO v_opponent_id
    FROM match_players mp
    WHERE mp.match_id = v_result.match_id
      AND mp.user_id <> v_result.submitted_by
      AND (v_submitter_team IS NULL OR mp.team <> v_submitter_team)
    LIMIT 1;

    IF v_opponent_id IS NULL THEN
      RAISE WARNING 'auto_confirm_expired_match_results: skip result_id=% match_id=% submitted_by=% (no opponent found)',
        v_result.id, v_result.match_id, v_result.submitted_by;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE match_results
    SET confirmed = true,
        confirmed_by = v_opponent_id
    WHERE id = v_result.id;

    v_confirmed_count := v_confirmed_count + 1;

    v_elo_result := public.apply_elo_for_match_system(v_result.id);
    IF (v_elo_result->>'success')::boolean IS TRUE THEN
      v_elo_applied_count := v_elo_applied_count + 1;
      PERFORM public.notify_elo_changes_for_match(v_result.match_id);
    END IF;

    v_score_text := coalesce(nullif(trim(v_result.score_text), ''), 'Resultat');

    v_notified_count := v_notified_count + coalesce(
      public.notify_auto_confirmed_match_result(v_result.match_id, v_score_text),
      0
    );
  END LOOP;

  RETURN jsonb_build_object(
    'confirmed', v_confirmed_count,
    'elo_applied', v_elo_applied_count,
    'notified', v_notified_count,
    'skipped', v_skipped_count,
    'ran_at', now()
  );
END;
$function$;

-- ELO: underret spillere efter manuel bekræftelse (wrapper kalder core — patch via notify efter apply_elo_for_match)
CREATE OR REPLACE FUNCTION public.apply_elo_for_match(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
  v_match_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;
  v_out := public.apply_elo_for_match_core(p_match_result_id, v_uid, true);
  IF (v_out->>'success')::boolean IS TRUE THEN
    SELECT mr.match_id INTO v_match_id FROM public.match_results mr WHERE mr.id = p_match_result_id;
    IF v_match_id IS NOT NULL THEN
      PERFORM public.notify_elo_changes_for_match(v_match_id);
    END IF;
  END IF;
  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_elo_for_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_elo_for_match(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_elo_for_match_system(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_out jsonb;
  v_match_id uuid;
BEGIN
  v_out := public.apply_elo_for_match_core(p_match_result_id, NULL, false);
  IF (v_out->>'success')::boolean IS TRUE THEN
    SELECT mr.match_id INTO v_match_id FROM public.match_results mr WHERE mr.id = p_match_result_id;
    IF v_match_id IS NOT NULL THEN
      PERFORM public.notify_elo_changes_for_match(v_match_id);
    END IF;
  END IF;
  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_elo_for_match_system(uuid) FROM PUBLIC;

-- Fjern gammel 3-parameter invite-RPC (forvirrer schema cache)
DROP FUNCTION IF EXISTS public.notify_league_invite(uuid, text, text);

REVOKE ALL ON FUNCTION public._skip_duplicate_match_notification(uuid, text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._insert_system_notification(uuid, text, text, text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_elo_changes_for_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_auto_confirmed_match_result(uuid, text) FROM PUBLIC;
