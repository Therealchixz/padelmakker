-- Migration 20260520120314_notifications_suite_v2
-- Backfilled from sql:recovered/notifications_suite_v2.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Entity deep links + 7-param create_notification_for_user.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid;

CREATE OR REPLACE FUNCTION public.create_notification_for_user(
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
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  IF p_user_id = v_caller THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, p_entity_type, p_entity_id, false);
    RETURN;
  END IF;

  IF p_match_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = p_match_id AND mp.user_id = v_caller
    ) OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_match_id AND m.creator_id = v_caller
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
      VALUES (p_user_id, p_type, p_title, p_body, p_match_id, p_entity_type, p_entity_id, false);
      RETURN;
    END IF;
  END IF;

  IF p_entity_type IS NOT NULL AND p_entity_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, match_id, entity_type, entity_id, read)
    VALUES (p_user_id, p_type, p_title, p_body, p_match_id, p_entity_type, p_entity_id, false);
    RETURN;
  END IF;

  RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_user(uuid, text, text, text, uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_notifications_for_users(
  p_user_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_match_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  FOREACH v_uid IN ARRAY COALESCE(p_user_ids, '{}'::uuid[]) LOOP
    BEGIN
      PERFORM public.create_notification_for_user(
        v_uid, p_type, p_title, p_body, p_match_id, p_entity_type, p_entity_id
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notifications_for_users(uuid[], text, text, text, uuid, text, uuid) TO authenticated;
