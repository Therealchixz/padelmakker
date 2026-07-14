-- Kamp-watch: notify_match_watchers RPC (funktions-del).

CREATE OR REPLACE FUNCTION public.notify_match_watchers(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_match public.matches%ROWTYPE;
  v_creator public.profiles%ROWTYPE;
  v_match_elo integer;
  v_title text;
  v_body text;
  v_notified integer := 0;
  v_recipient_ids uuid[] := '{}'::uuid[];
  v_row record;
  v_daily integer;
  v_elo_min integer;
  v_elo_max integer;
  v_max_per_match constant integer := 8;
  v_max_per_day constant integer := 2;
  v_elo_window constant integer := 250;
  v_inactive_days constant integer := 21;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  SELECT * INTO v_match FROM public.matches m WHERE m.id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kamp findes ikke');
  END IF;

  IF COALESCE(v_match.status, '') <> 'open'
     OR COALESCE(v_match.match_type, 'open') = 'closed'
     OR COALESCE(v_match.current_players, 0) >= COALESCE(v_match.max_players, 4) THEN
    RETURN jsonb_build_object('ok', true, 'notified', 0, 'recipient_ids', '[]'::jsonb, 'skipped', 'not_open');
  END IF;

  IF v_caller IS DISTINCT FROM v_match.creator_id
     AND NOT COALESCE(public.is_user_admin_verified(v_caller), public.is_admin(), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kun kampens opretter kan underrette watchere');
  END IF;

  SELECT * INTO v_creator FROM public.profiles p WHERE p.id = v_match.creator_id;
  v_match_elo := GREATEST(100, ROUND(COALESCE(v_creator.elo_rating, 1000))::integer);
  v_elo_min := v_match_elo - v_elo_window;
  v_elo_max := v_match_elo + v_elo_window;

  v_title := 'Ny kamp passer til dig';
  v_body := format(
    'Åben kamp på %s%s%s · ELO ~%s',
    COALESCE(NULLIF(trim(v_match.court_name), ''), 'en bane'),
    CASE WHEN v_match.date IS NOT NULL THEN ' · ' || to_char(v_match.date::date, 'DD/MM') ELSE '' END,
    CASE WHEN v_match.time IS NOT NULL THEN ' kl. ' || left(v_match.time::text, 5) ELSE '' END,
    v_match_elo
  );

  FOR v_row IN
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.match_watch_enabled = true
      AND COALESCE(p.is_banned, false) = false
      AND p.id <> v_match.creator_id
      AND p.id <> ALL (
        SELECT mp.user_id FROM public.match_players mp WHERE mp.match_id = p_match_id
      )
      AND (
        NULLIF(trim(COALESCE(v_creator.area, '')), '') IS NULL
        OR lower(trim(COALESCE(p.area, ''))) = lower(trim(v_creator.area))
      )
      AND GREATEST(100, ROUND(COALESCE(p.elo_rating, 1000))::integer) BETWEEN v_elo_min AND v_elo_max
      AND (
        p.last_active_at IS NULL
        OR p.last_active_at >= (now() - (v_inactive_days || ' days')::interval)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id
          AND n.type = 'match_watch_match'
          AND n.match_id = p_match_id
          AND n.created_at >= now() - interval '7 days'
      )
    ORDER BY
      (CASE WHEN p.seeking_match = true THEN 1 ELSE 0 END) DESC,
      p.last_active_at DESC NULLS LAST,
      p.id
    LIMIT v_max_per_match * 3
  LOOP
    EXIT WHEN v_notified >= v_max_per_match;

    v_daily := public.discovery_notifications_today_count(v_row.user_id);
    IF v_daily >= v_max_per_day THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (v_row.user_id, 'match_watch_match', v_title, v_body, p_match_id, false);

    v_notified := v_notified + 1;
    v_recipient_ids := array_append(v_recipient_ids, v_row.user_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'notified', v_notified,
    'recipient_ids', to_jsonb(v_recipient_ids),
    'notify_title', v_title,
    'notify_body', v_body,
    'match_elo', v_match_elo
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_match_watchers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_watchers(uuid) TO authenticated;
