-- Admin: slet en 2v2-kamp (også andres) via verificeret admin-session.
-- Frontend: supabase.rpc('admin_delete_match', { p_match_id: '<uuid>' })

CREATE OR REPLACE FUNCTION public.admin_delete_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ikke logget ind');
  END IF;

  IF NOT COALESCE(public.is_user_admin_verified(v_actor_id), false)
     AND NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object(
      'ok',
      false,
      'error',
      'Admin-session udløbet — åbn Admin-fanen og indtast PIN igen.'
    );
  END IF;

  IF p_match_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mangler kamp-id');
  END IF;

  DELETE FROM public.matches WHERE id = p_match_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kampen blev ikke fundet');
  END IF;

  PERFORM public._admin_audit_log(
    'delete_match',
    NULL,
    jsonb_build_object('match_id', p_match_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_match(uuid) TO authenticated;
