-- Migration 20260416135303_notify_creator_join_request_rpc
-- Backfilled from sql:recovered/notify_creator_join_request_rpc.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

CREATE OR REPLACE FUNCTION public.notify_creator_join_request(
  p_match_id uuid,
  p_title text,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller uuid;
  v_creator uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT creator_id INTO v_creator
  FROM public.matches
  WHERE id = p_match_id;

  IF v_creator IS NULL THEN
    RETURN;
  END IF;

  IF v_creator = v_caller THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.match_join_requests r
    WHERE r.match_id = p_match_id
      AND r.user_id = v_caller
      AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ingen gyldig pending anmodning for denne kamp';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, match_id, read)
  VALUES (v_creator, 'match_invite', p_title, p_body, p_match_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_creator_join_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_creator_join_request(uuid, text, text) TO authenticated;
