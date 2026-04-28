-- =============================================================================
-- FIX: Tillad andre deltagere at afvise (slette) et ubekræftet resultat
-- =============================================================================
-- Bug:
--   Den eksisterende DELETE-politik på match_results tillader KUN
--   submitted_by + admin.  Når en anden spiller (modspiller) klikker
--   "Afvis", fejler DELETE'et stille pga. RLS, og rækken bliver i
--   databasen — UI'et viser stadig samme resultat efter "Afvis".
--
-- Fix:
--   Udvid DELETE til også at tillade øvrige deltagere i kampen, så
--   længe resultatet IKKE er bekræftet endnu.  Bekræftede resultater
--   forbliver immutable (kun admin kan slette dem).
--
-- Idempotent.  Kør i Supabase → SQL Editor → Run.
-- =============================================================================

DROP POLICY IF EXISTS "Indsenderen kan slette afviste resultater" ON public.match_results;
DROP POLICY IF EXISTS "Deltagere kan afvise ubekraeftede resultater" ON public.match_results;

CREATE POLICY "Deltagere kan afvise ubekraeftede resultater"
  ON public.match_results
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR submitted_by = (SELECT auth.uid())
    OR (
      confirmed IS NOT TRUE
      AND EXISTS (
        SELECT 1
        FROM public.match_players mp
        WHERE mp.match_id = match_results.match_id
          AND mp.user_id  = (SELECT auth.uid())
      )
    )
  );


-- =============================================================================
-- VERIFICERING
-- =============================================================================
/*
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'match_results'
  AND cmd = 'DELETE';
*/
