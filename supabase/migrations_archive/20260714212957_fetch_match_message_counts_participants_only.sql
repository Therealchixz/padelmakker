-- Match chat counts: respekter RLS (kun deltagere ser beskeder).

CREATE OR REPLACE FUNCTION public.fetch_match_message_counts(p_match_ids uuid[])
RETURNS TABLE(match_id uuid, message_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT mm.match_id, COUNT(*)::bigint AS message_count
  FROM public.match_messages mm
  WHERE p_match_ids IS NOT NULL
    AND cardinality(p_match_ids) > 0
    AND mm.match_id = ANY(p_match_ids)
  GROUP BY mm.match_id;
$$;

REVOKE ALL ON FUNCTION public.fetch_match_message_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_match_message_counts(uuid[]) TO authenticated;
