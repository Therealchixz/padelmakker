-- =============================================================================
-- DM-samtaleoversigt i ét RPC-kald (seneste besked + ulæst per partner)
-- Kør i Supabase → SQL Editor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_dm_conversation_summaries(
  p_scan_limit integer DEFAULT 800
)
RETURNS TABLE (
  other_user_id uuid,
  last_message_id uuid,
  last_sender_id uuid,
  last_receiver_id uuid,
  last_content text,
  last_created_at timestamptz,
  last_is_read boolean,
  unread_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_limit integer;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  v_limit := GREATEST(50, LEAST(coalesce(p_scan_limit, 800), 2000));

  RETURN QUERY
  WITH scoped AS (
    SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at, m.is_read
    FROM public.messages m
    WHERE m.sender_id = v_caller OR m.receiver_id = v_caller
    ORDER BY m.created_at DESC
    LIMIT v_limit
  ),
  latest AS (
    SELECT DISTINCT ON (
      CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END
    )
      CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END AS other_user_id,
      s.id AS last_message_id,
      s.sender_id AS last_sender_id,
      s.receiver_id AS last_receiver_id,
      s.content AS last_content,
      s.created_at AS last_created_at,
      s.is_read AS last_is_read
    FROM scoped s
    ORDER BY
      CASE WHEN s.sender_id = v_caller THEN s.receiver_id ELSE s.sender_id END,
      s.created_at DESC
  )
  SELECT
    l.other_user_id,
    l.last_message_id,
    l.last_sender_id,
    l.last_receiver_id,
    l.last_content,
    l.last_created_at,
    l.last_is_read,
    (
      SELECT count(*)::bigint
      FROM scoped u
      WHERE u.receiver_id = v_caller
        AND u.sender_id = l.other_user_id
        AND u.is_read = false
    ) AS unread_count
  FROM latest l
  ORDER BY l.last_created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_dm_conversation_summaries(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_dm_conversation_summaries(integer) TO authenticated;
