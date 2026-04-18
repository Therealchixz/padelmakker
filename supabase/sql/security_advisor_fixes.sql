-- =============================================================================
-- Retter typiske Supabase Security Advisor-advarsler (database-delen)
-- =============================================================================
-- Kør i Supabase → SQL Editor (én blok ad gangen hvis noget fejler).
--
-- Dækker:
--   1) function_search_path_mutable — protect_elo_fields, handle_new_user, apply_elo_for_match
--   2) rls_policy_always_true — court_slots policy "Slots insertable"
--
-- IKKE SQL (gør i Dashboard):
--   • auth_leaked_password_protection → Authentication → (Email) → slå
--     "Leaked password protection" til. Se:
--     https://supabase.com/docs/guides/auth/password-security
-- =============================================================================

-- ─── 1) Fastlås search_path på funktioner (mod search_path-manipulation) ───
-- Finder alle overloads i public med disse navne og sætter search_path = public.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'protect_elo_fields',
        'handle_new_user',
        'apply_elo_for_match',
        'recalc_profile_stats_from_elo_history',
        'recalc_americano_profile_stats',
        'trg_americano_match_recalc_stats',
        'trg_elo_history_sync_profile',
        'create_notification_for_user',
        'notify_match_creator_on_join',
        'public_upcoming_americano_events'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    RAISE NOTICE 'SET search_path på %', r.sig;
  END LOOP;
END $$;

-- Hvis en af funktionerne ikke findes, springer løkken den over — tjek NOTICE i resultat.
-- Hvis du får fejl fordi funktionen ligger i et andet schema, ret nspname ovenfor.


-- ─── 2) court_slots: fjern INSERT der er WITH CHECK (true) / effektivt altid sand ───
-- PadelMakker-appen henter kun slots (CourtSlot.filter); den indsætter ikke rækker som bruger.
-- Derfor: slet den åbne INSERT-policy. authenticated + anon har så INGEN INSERT via RLS.
-- Vedligehold slots via Supabase SQL Editor eller service_role (bypasser RLS) — ikke fra anon key i browser.
--
-- Hvis I senere skal lade bestemte brugere oprette slots, tilføj kolonne (fx created_by uuid)
-- og brug: WITH CHECK (created_by = (SELECT auth.uid())).

DROP POLICY IF EXISTS "Slots insertable" ON public.court_slots;

-- Valgfrit: eksplicit afvis alle INSERT for authenticated (tydeligere end "ingen policy").
-- Fjern kommentarer hvis du vil have denne eksplicitte politik:
-- CREATE POLICY "court_slots_no_client_insert"
--   ON public.court_slots
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (false);
