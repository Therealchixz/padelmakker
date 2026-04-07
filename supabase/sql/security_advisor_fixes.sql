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
        'apply_elo_for_match'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    RAISE NOTICE 'SET search_path på %', r.sig;
  END LOOP;
END $$;

-- Hvis en af funktionerne ikke findes, springer løkken den over — tjek NOTICE i resultat.
-- Hvis du får fejl fordi funktionen ligger i et andet schema, ret nspname ovenfor.


-- ─── 2) court_slots: INSERT må ikke være WITH CHECK (true) for alle roller ───
-- Erstatter med: kun loggede brugere (authenticated). Tilpas hvis kun admins må oprette slots
-- (fx med en is_admin() eller membership-tabel).

DROP POLICY IF EXISTS "Slots insertable" ON public.court_slots;

CREATE POLICY "Slots insertable"
  ON public.court_slots
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Hvis I kun vil tillade service role / bestemte brugere, skift til fx:
--   TO authenticated
--   WITH CHECK ( (SELECT auth.jwt() ->> 'role') = 'authenticated' AND ... );
