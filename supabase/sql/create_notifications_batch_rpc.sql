-- =============================================================================
-- Batch-notifikationer + seeking_player-fix
-- Kør i Supabase → SQL Editor (efter create_notification_rpc.sql).
-- =============================================================================

-- Tillad kampopretter/deltager at underrette kandidater der ikke er tilmeldt endnu.
CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_user_id = (SELECT auth.uid()) THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'Manglende match_id for notifikation til anden bruger';
  END IF;

  IF p_type = 'seeking_player' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id AND mp.user_id = (SELECT auth.uid())
    ) AND NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_match_id AND m.creator_id = (SELECT auth.uid())
    ) THEN
      RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id
      AND mp.user_id = p_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id
      AND m.creator_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Modtager er ikke relateret til denne kamp';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = p_match_id AND m.creator_id = (SELECT auth.uid())
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
END;
$$;

-- Opret in-app notifikationer til flere brugere i ét kald (samme regler som ovenfor).
CREATE OR REPLACE FUNCTION public.create_notifications_for_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_uid uuid;
  v_inserted integer := 0;
  v_distinct uuid[];
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN 0;
  END IF;

  SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[])
  INTO v_distinct
  FROM unnest(p_user_ids) AS x
  WHERE x IS NOT NULL;

  IF cardinality(v_distinct) > 50 THEN
    RAISE EXCEPTION 'For mange modtagere (max 50)';
  END IF;

  FOREACH v_uid IN ARRAY v_distinct
  LOOP
    BEGIN
      IF v_uid = v_caller THEN
        INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
        VALUES (v_uid, p_type, p_title, p_body, p_match_id, false);
        v_inserted := v_inserted + 1;
        CONTINUE;
      END IF;

      IF p_match_id IS NULL THEN
        CONTINUE;
      END IF;

      IF p_type = 'seeking_player' THEN
        IF EXISTS (
          SELECT 1 FROM public.match_players mp
          WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
        ) OR EXISTS (
          SELECT 1 FROM public.matches m
          WHERE m.id = p_match_id AND m.creator_id = v_caller
        ) THEN
          INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
          VALUES (v_uid, p_type, p_title, p_body, p_match_id, false);
          v_inserted := v_inserted + 1;
        END IF;
        CONTINUE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id = v_uid
      ) AND NOT EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = p_match_id AND m.creator_id = v_uid
      ) THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
      ) OR EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = p_match_id AND m.creator_id = v_caller
      ) THEN
        INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
        VALUES (v_uid, p_type, p_title, p_body, p_match_id, false);
        v_inserted := v_inserted + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, uuid) TO authenticated;
