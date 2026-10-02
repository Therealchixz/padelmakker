-- Admin: slet spiller — ret fejlen "admin_audit_log_target_user_id_fkey"
-- (ejeren 2. okt. 2026, da en bruger bad om at få sin konto slettet).
--
-- Før blev handlingen skrevet i admin_audit_log EFTER at profilen var slettet,
-- med target_user_id = den slettede spiller. Fremmednøglen til profiles afviste
-- det, og hele sletningen blev rullet tilbage. Nu skrives loggen FØR profilen
-- slettes; target_user_id sættes til NULL af ON DELETE SET NULL, og id'et
-- gemmes i details.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_target_email text;
  v_target_role text;
  v_mids uuid[];
  v_deleted_matches integer := 0;
  v_pin_check jsonb;
  v_pin_ok boolean := false;
  v_pin_reason text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;
  IF NOT public.has_admin_role() THEN
    RETURN jsonb_build_object('error', 'Kun admin kan slette spillere');
  END IF;
  v_pin_check := public.admin_verify_pin(p_pin, 5);
  v_pin_ok := COALESCE((v_pin_check->>'ok')::boolean, false);
  IF NOT v_pin_ok THEN
    v_pin_reason := COALESCE(v_pin_check->>'reason', 'invalid');
    IF v_pin_reason = 'locked' THEN
      RETURN jsonb_build_object('error', 'For mange forkerte kodeforsøg. Prøv igen senere.', 'reason', 'locked', 'locked_until', v_pin_check->>'locked_until');
    END IF;
    RETURN jsonb_build_object('error', 'Forkert eller manglende admin-kode');
  END IF;
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('error', 'Mangler user_id'); END IF;
  IF p_user_id = v_actor_id THEN RETURN jsonb_build_object('error', 'Du kan ikke slette din egen admin-konto'); END IF;
  SELECT u.email INTO v_target_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_target_email IS NULL THEN RETURN jsonb_build_object('error', 'Bruger findes ikke i auth.users'); END IF;
  SELECT p.role INTO v_target_role FROM public.profiles p WHERE p.id = p_user_id;
  IF COALESCE(v_target_role, '') = 'admin' THEN RETURN jsonb_build_object('error', 'Admin-konti kan ikke slettes via denne handling'); END IF;
  IF to_regclass('public.league_matches') IS NOT NULL THEN
    EXECUTE 'UPDATE public.league_matches SET reported_by = NULL WHERE reported_by = $1' USING p_user_id;
  END IF;
  IF to_regclass('public.matches') IS NOT NULL AND to_regclass('public.match_players') IS NOT NULL THEN
    EXECUTE $SQL$ SELECT array_agg(DISTINCT m)::uuid[] FROM (SELECT id AS m FROM public.matches WHERE creator_id = $1 UNION SELECT match_id AS m FROM public.match_players WHERE user_id = $1 AND match_id IS NOT NULL) s $SQL$ INTO v_mids USING p_user_id;
  END IF;
  IF v_mids IS NOT NULL AND cardinality(v_mids) > 0 THEN
    IF to_regclass('public.match_results') IS NOT NULL THEN EXECUTE 'DELETE FROM public.match_results WHERE match_id = ANY ($1)' USING v_mids; END IF;
    EXECUTE 'DELETE FROM public.match_players WHERE match_id = ANY ($1)' USING v_mids;
    EXECUTE 'DELETE FROM public.matches WHERE id = ANY ($1)' USING v_mids;
    v_deleted_matches := cardinality(v_mids);
  END IF;
  IF to_regclass('public.elo_history') IS NOT NULL THEN EXECUTE 'DELETE FROM public.elo_history WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN EXECUTE 'DELETE FROM public.messages WHERE sender_id = $1 OR receiver_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.user_blocks') IS NOT NULL THEN EXECUTE 'DELETE FROM public.user_blocks WHERE blocker_id = $1 OR blocked_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.user_reports') IS NOT NULL THEN EXECUTE 'DELETE FROM public.user_reports WHERE reporter_id = $1 OR reported_id = $1 OR resolved_by = $1' USING p_user_id; END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN EXECUTE 'DELETE FROM public.push_subscriptions WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.americano_tournaments') IS NOT NULL THEN EXECUTE 'DELETE FROM public.americano_tournaments WHERE creator_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.americano_participants') IS NOT NULL THEN EXECUTE 'DELETE FROM public.americano_participants WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.league_participants') IS NOT NULL THEN EXECUTE 'DELETE FROM public.league_participants WHERE user_id = $1' USING p_user_id; END IF;
  IF to_regclass('public.leagues') IS NOT NULL THEN EXECUTE 'UPDATE public.leagues SET created_by = NULL WHERE created_by = $1' USING p_user_id; END IF;
  -- Log før profilen slettes (fremmednøglen sætter target_user_id til NULL bagefter).
  PERFORM public._admin_audit_log(
    'delete_user',
    p_user_id,
    jsonb_build_object('deleted_user_id', p_user_id, 'deleted_email', v_target_email, 'deleted_matches', v_deleted_matches)
  );
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'deleted_user_id', p_user_id, 'deleted_email', v_target_email, 'deleted_matches', v_deleted_matches);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text) TO authenticated;
