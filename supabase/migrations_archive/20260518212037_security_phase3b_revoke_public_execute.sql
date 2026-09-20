-- Migration 20260518212037_security_phase3b_revoke_public_execute
-- Backfilled from sql:invisible_security_hardening.sql (2026-07-14).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

-- =============================================================================
-- Usynlig sikkerhedshærdning (ingen ændring af social UX: kampe/profiler/stats)
-- Kør i Supabase SQL Editor. Leaked-password protection springes over (betalt plan).
-- =============================================================================

-- ─── 1) RPC: fjern anon-adgang til alt undtagen offentlig landing/events ─────

DO $$
DECLARE
  r record;
  v_whitelist text[] := ARRAY[
    'public_platform_stats',
    'public_upcoming_americano_events'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT (p.proname = ANY (v_whitelist))
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'revoke anon %: %', r.sig, SQLERRM;
    END;
  END LOOP;
END
$$;

-- Eksplicit: offentlige landing-RPC'er (idempotent)
GRANT EXECUTE ON FUNCTION public.public_platform_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.public_upcoming_americano_events(integer) TO anon;

-- ─── 2) RPC: trigger/interne funktioner — ikke callable via PostgREST ────────

DO $$
DECLARE
  r record;
  v_internal text[] := ARRAY[
    'handle_new_user',
    'messages_enforce_dm_block',
    'guard_americano_complete_transition',
    'auto_confirm_expired_match_results',
    'archive_profile_before_delete',
    'apply_elo_for_match_system',
    'apply_glicko2_shadow_for_match',
    'detect_and_flag_suspicious_2v2_match',
    -- americano_internal_* / americano_is_participant: bruges i RLS SELECT-policies —
    -- authenticated skal kunne EXECUTE (se americano_rls_visibility.sql).
    '_americano_entity_finished_at',
    '_league_entity_finished_at',
    'recalc_americano_elo_from_history',
    'recalc_profile_stats_from_elo_history',
    'recalc_americano_profile_stats',
    'create_rating_admin_flag',
    'apply_elo_for_match_core'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname = ANY (v_internal)
        OR p.proname LIKE 'trg\_%'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'revoke internal %: %', r.sig, SQLERRM;
    END;
  END LOOP;
END
$$;

-- Admin-only telefon-exempt (hvis funktionen findes)
DO $$
BEGIN
  IF to_regprocedure('public.admin_set_phone_verification_exempt(uuid,boolean)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.admin_set_phone_verification_exempt(uuid, boolean) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.admin_set_phone_verification_exempt(uuid, boolean) FROM anon;
    GRANT EXECUTE ON FUNCTION public.admin_set_phone_verification_exempt(uuid, boolean) TO authenticated;
  END IF;
END
$$;

-- check_rate_limit: fastlås search_path (Security Advisor)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_rate_limit'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END
$$;

-- ─── 3) Storage avatars: fjern bred SELECT (forhindrer listing; public URL virker) ─

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

-- Behold/opret kun object-level læsning hvis bucket er public (valgfri smal policy)
-- Public buckets: direkte URL kræver ikke denne policy; vi tilføjer ikke ny bred SELECT.

NOTIFY pgrst, 'reload schema';
