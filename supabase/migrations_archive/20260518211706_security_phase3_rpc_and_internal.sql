-- Migration 20260518211706_security_phase3_rpc_and_internal
-- Backfilled from sql:admin_security_phase3_rpc.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- Del af admin_security_phase3 — RPC-hårdning og audit (inkluderes i fuld migration)

-- ─── protect_elo_fields: phone_verification_exempt ────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_elo_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF
    NEW.elo_rating IS DISTINCT FROM OLD.elo_rating
    OR NEW.games_played IS DISTINCT FROM OLD.games_played
    OR NEW.games_won IS DISTINCT FROM OLD.games_won
    OR NEW.americano_elo_rating IS DISTINCT FROM OLD.americano_elo_rating
    OR NEW.americano_played IS DISTINCT FROM OLD.americano_played
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
    OR (
      to_jsonb(NEW) ? 'phone_verification_exempt'
      AND NEW.phone_verification_exempt IS DISTINCT FROM OLD.phone_verification_exempt
    )
  THEN
    RAISE EXCEPTION 'Protected profile fields cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Resultat-bekræftelse: admin skal have PIN ────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_valid_match_result_confirmation(
  p_match_id uuid,
  p_submitted_by uuid,
  p_confirmed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $confirm_guard$
BEGIN
  IF p_match_id IS NULL OR p_confirmed_by IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_user_admin_verified(p_confirmed_by) THEN
    RETURN true;
  END IF;

  RETURN public.can_confirm_match_result(p_match_id, p_submitted_by, p_confirmed_by);
END;
$confirm_guard$;

-- ─── admin_set_phone_verification_exempt ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_phone_verification_exempt(
  p_user_id uuid,
  p_exempt boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Kun admin med verificeret PIN kan ændre telefon-undtagelse');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler user_id');
  END IF;

  UPDATE public.profiles
  SET phone_verification_exempt = COALESCE(p_exempt, false)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profil findes ikke');
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('phone_verification_exempt', COALESCE(p_exempt, false))
  WHERE id = p_user_id;

  PERFORM public._admin_audit_log(
    'phone_verification_exempt',
    p_user_id,
    jsonb_build_object('exempt', COALESCE(p_exempt, false))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'phone_verification_exempt', COALESCE(p_exempt, false)
  );
END;
$$;

-- ─── admin_restore_deleted_profile ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_restore_deleted_profile(
  p_archive_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_id uuid;
  v_archive public.deleted_players_archive%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Ikke logget ind');
  END IF;

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Kun admin med verificeret PIN kan restore profiler');
  END IF;

  IF p_archive_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Mangler archive_id eller target_user_id');
  END IF;

  SELECT *
    INTO v_archive
  FROM public.deleted_players_archive
  WHERE id = p_archive_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Archive entry ikke fundet');
  END IF;

  IF v_archive.restored_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Denne archive entry er allerede restored');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RETURN jsonb_build_object('error', 'target_user_id findes ikke i auth.users');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_target_user_id) THEN
    RETURN jsonb_build_object('error', 'Der findes allerede en profil for target_user_id');
  END IF;

  INSERT INTO public.profiles
  SELECT (jsonb_populate_record(
    null::public.profiles,
    jsonb_set(v_archive.profile_snapshot, '{id}', to_jsonb(p_target_user_id), true)
  )).*;

  UPDATE public.deleted_players_archive
  SET restored_at = now(),
      restored_by = v_actor_id,
      restored_user_id = p_target_user_id
  WHERE id = p_archive_id;

  PERFORM public._admin_audit_log(
    'restore_deleted_profile',
    p_target_user_id,
    jsonb_build_object('archive_id', p_archive_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'archive_id', p_archive_id,
    'restored_user_id', p_target_user_id
  );
END;
$$;

-- ─── admin_adjust_elo + audit ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_new_elo int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_elo int;
  v_first_id uuid;
  v_first_old numeric;
  v_diff numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Adgang nægtet: Kun admins kan justere ELO manuelt.';
  END IF;

  SELECT elo_rating INTO v_current_elo FROM public.profiles WHERE id = p_user_id;

  SELECT id, old_rating INTO v_first_id, v_first_old
  FROM public.elo_history
  WHERE user_id = p_user_id
    AND old_rating IS NOT NULL
    AND match_id IS NOT NULL
  ORDER BY date ASC, match_id ASC, id ASC
  LIMIT 1;

  IF v_first_id IS NOT NULL THEN
    v_diff := p_new_elo - v_current_elo;

    UPDATE public.elo_history
    SET old_rating = old_rating + v_diff
    WHERE id = v_first_id;
  ELSE
    UPDATE public.profiles
    SET elo_rating = p_new_elo
    WHERE id = p_user_id;
  END IF;

  PERFORM public._admin_audit_log(
    'adjust_elo',
    p_user_id,
    jsonb_build_object('new_elo', p_new_elo, 'previous_elo', v_current_elo)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
