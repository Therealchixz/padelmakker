-- =============================================================================
-- RLS POLICY CLEANUP — Fjerner forældede/duplikerede politikker (policy-drift)
-- =============================================================================
-- Baggrund:
--   rls_fix_19_linter_warnings.sql blev kun delvist kørt i live-databasen.
--   Resultatet er at gamle policies lever side om side med nye, og at
--   én UPDATE-policy på matches har en SQL-bug.
--
-- Hvad dette script gør:
--   1) profiles   — fjerner 3 forældede policies, opretter korrekte versioner
--   2) matches    — fjerner FOR ALL admin-policy + retter SQL-bug i UPDATE
--   3) match_players — erstatter to overlappende DELETE policies med én
--   4) match_results — fjerner FOR ALL admin + opgraderer INSERT til at kræve deltagelse
--   5) elo_history  — fjerner redundant public SELECT + FOR ALL admin
--
-- Scriptet er idempotent (DROP IF EXISTS + CREATE OR REPLACE hvor muligt).
-- Kør i Supabase → SQL Editor → Run.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) PROFILES
--    Problem A: "Brugere kan opdatere eigen profil" (public-rolle) omgår is_banned-tjekket
--               i "Users can update own profile" fordi PERMISSIVE-policies er OR-baserede.
--    Problem B: "Users can update own profile" er den ældre version — den nye fra
--               rls_fix_19 blev aldrig oprettet korrekt.
--    Problem C: profiles_admin_all (FOR ALL) giver linter-advarsel 0006.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fjern alle forældede UPDATE/INSERT/DELETE policies på profiles
DROP POLICY IF EXISTS "Brugere kan opdatere eigen profil"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"       ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all                   ON public.profiles;
DROP POLICY IF EXISTS "Brugere kan oprette eigen profil"   ON public.profiles;
DROP POLICY IF EXISTS "Ingen kan slette profiler"          ON public.profiles;

-- INSERT: kun egen række, eller admin
CREATE POLICY "Brugere kan oprette eigen profil"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR public.is_admin()
  );

-- UPDATE: kun egen række (trigger protect_elo_fields beskytter elo/role/is_banned),
--         admin må alt.
CREATE POLICY "Brugere kan opdatere eigen profil"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR public.is_admin()
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR public.is_admin()
  );

-- DELETE: kun admin
CREATE POLICY "Ingen kan slette profiler"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) MATCHES
--    Problem A: matches_admin_all (FOR ALL) giver linter-advarsel 0006.
--    Problem B: matches_update_by_creator_or_participant har en SQL-bug:
--               bruger  match_players.match_id = match_players.id  (self-join)
--               i stedet for  match_players.match_id = matches.id.
--               Det betyder at deltagere i praksis IKKE kan opdatere en kamp
--               (f.eks. sætte status til in_progress), selvom RLS-kommentarerne
--               antyder det er hensigten.
--               Derudover mangler WITH CHECK og rollen er {public} i stedet for
--               {authenticated}.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS matches_admin_all                       ON public.matches;
DROP POLICY IF EXISTS matches_update_by_creator_or_participant ON public.matches;

-- UPDATE: opretter + deltagere kan opdatere deres egne kampe.
--         WITH CHECK spejler USING, så deltagere kan sætte status til
--         'in_progress' når de starter kampen.  (Tidligere udelod WITH CHECK
--         deltager-leddet, hvilket blokerede både deltagere OG admins uden
--         gyldig PIN-session — is_admin() returnerer false uden verificeret PIN.)
CREATE POLICY matches_update_by_creator_or_participant
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (
    creator_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = matches.id            -- ← rettet fra den buggy version
        AND mp.user_id  = (SELECT auth.uid())
    )
    OR public.is_admin()
  )
  WITH CHECK (
    creator_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.match_players mp
      WHERE mp.match_id = matches.id
        AND mp.user_id  = (SELECT auth.uid())
    )
    OR public.is_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) MATCH_PLAYERS
--    Problem: To separate DELETE policies eksisterer parallelt, rls_fix_19's
--             kombinerede policy (match_players_delete_self_or_creator) blev
--             aldrig oprettet i live-databasen.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Brugere kan afmelde sig selv"            ON public.match_players;
DROP POLICY IF EXISTS "Creators can remove all players from own match" ON public.match_players;
DROP POLICY IF EXISTS match_players_delete_self_or_creator      ON public.match_players;

-- Kombineret DELETE: man kan fjerne sig selv, opretter kan fjerne alle fra sin kamp
CREATE POLICY match_players_delete_self_or_creator
  ON public.match_players
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_players.match_id
        AND m.creator_id = (SELECT auth.uid())
    )
    OR public.is_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) MATCH_RESULTS
--    Problem A: match_results_admin_all (FOR ALL) giver linter-advarsel 0006.
--    Problem B: "Deltagere kan indsende resultater" (public-rolle) tjekker kun
--               submitted_by = auth.uid() — men ikke om brugeren rent faktisk er
--               deltager i kampen. Enhver logget bruger kan indsende et resultat
--               for en kamp de aldrig spillede.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS match_results_admin_all             ON public.match_results;
DROP POLICY IF EXISTS "Deltagere kan indsende resultater" ON public.match_results;

-- INSERT: submitted_by skal være én selv OG man skal være tilmeldt kampen
CREATE POLICY "Deltagere kan indsende resultater"
  ON public.match_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      submitted_by = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id = match_results.match_id
          AND mp.user_id  = (SELECT auth.uid())
      )
    )
    OR public.is_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) ELO_HISTORY
--    Problem A: "Alle kan se ELO-historik" (public-rolle) eksisterer parallelt
--               med elo_history_select_authenticated — redundant men ufarlig.
--    Problem B: elo_history_admin_all (FOR ALL) giver linter-advarsel 0006.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Alle kan se ELO-historik" ON public.elo_history;
DROP POLICY IF EXISTS elo_history_admin_all       ON public.elo_history;

-- Erstat FOR ALL admin med eksplicitte per-handling policies
-- (SELECT er allerede dækket af elo_history_select_authenticated)

DROP POLICY IF EXISTS elo_history_admin_insert ON public.elo_history;
CREATE POLICY elo_history_admin_insert
  ON public.elo_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS elo_history_admin_update ON public.elo_history;
CREATE POLICY elo_history_admin_update
  ON public.elo_history
  FOR UPDATE
  TO authenticated
  USING    (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS elo_history_admin_delete ON public.elo_history;
CREATE POLICY elo_history_admin_delete
  ON public.elo_history
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- =============================================================================
-- VERIFICERING
-- Kør denne SELECT bagefter og tjek at der ikke er forældede policies tilbage:
-- =============================================================================
/*
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','matches','match_players','match_results','elo_history')
ORDER BY tablename, cmd, policyname;

Forventede politikker efter cleanup:

profiles:
  SELECT  authenticated  profiles_select_all_authenticated
  INSERT  authenticated  "Brugere kan oprette eigen profil"
  UPDATE  authenticated  "Brugere kan opdatere eigen profil"
  DELETE  authenticated  "Ingen kan slette profiler"

matches:
  SELECT  public  "Alle kan se kampe"
  INSERT  authenticated  "Autentificerede kan oprette kampe"
  UPDATE  authenticated  matches_update_by_creator_or_participant
  DELETE  public  "Opretteren kan slette sin kamp"

match_players:
  SELECT  public  "Alle kan se match_players"
  INSERT  public  "Brugere kan tilmelde sig selv"
  DELETE  authenticated  match_players_delete_self_or_creator

match_results:
  SELECT  public  "Alle kan se resultater"
  INSERT  authenticated  "Deltagere kan indsende resultater"
  UPDATE  authenticated  match_results_update_by_participant
  DELETE  public  "Indsenderen kan slette afviste resultater"

elo_history:
  SELECT  authenticated  elo_history_select_authenticated
  INSERT  public         elo_history_no_insert  (WITH CHECK: false — blokerer anon)
  INSERT  authenticated  elo_history_admin_insert
  UPDATE  public         elo_history_no_update  (USING: false — blokerer anon)
  UPDATE  authenticated  elo_history_admin_update
  DELETE  public         elo_history_no_delete  (USING: false — blokerer anon)
  DELETE  authenticated  elo_history_admin_delete
*/
