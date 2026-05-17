-- =============================================================================
-- Admin: læs DM-tråd mellem anmelder og anmeldt (til gennemgang af anmeldelser)
-- Kør i Supabase → SQL Editor efter user_blocks_and_reports.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_dm_messages_between(
  p_user_a uuid,
  p_user_b uuid,
  p_limit integer DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  content text,
  created_at timestamptz,
  is_read boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Kun admin med verificeret PIN kan læse beskeder til anmeldelsesgennemgang';
  END IF;

  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RETURN;
  END IF;

  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 300), 500));

  RETURN QUERY
  SELECT m.id, m.sender_id, m.receiver_id, m.content, m.created_at, m.is_read
  FROM public.messages m
  WHERE (
      (m.sender_id = p_user_a AND m.receiver_id = p_user_b)
      OR (m.sender_id = p_user_b AND m.receiver_id = p_user_a)
    )
  ORDER BY m.created_at ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_dm_messages_between(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_dm_messages_between(uuid, uuid, integer) TO authenticated;
