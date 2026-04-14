-- =============================================================================
-- Fix: 19 Supabase RLS performance warnings (0003 + 0006)
-- =============================================================================
-- Formål:
--   1) Fjerne auth_rls_initplan på profiles update policy
--   2) Reducere multiple_permissive_policies ved at merge admin-adgang ind i
--      de eksisterende action-specifikke policies i stedet for FOR ALL admin policy.
--
-- Kør i Supabase SQL Editor.
-- Scriptet er idempotent via DROP POLICY IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) profiles: fix auth.uid() initplan + merge admin adgang i samme policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Brugere kan opdatere egen profil" ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;

-- SELECT
DROP POLICY IF EXISTS profiles_select_all_authenticated ON public.profiles;
CREATE POLICY profiles_select_all_authenticated
  ON public.profiles
  FOR SELECT TO authenticated
  USING (true OR public.is_admin());

-- INSERT
DROP POLICY IF EXISTS "Brugere kan oprette egen profil" ON public.profiles;
CREATE POLICY "Brugere kan oprette egen profil"
  ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id OR public.is_admin());

-- UPDATE (0003 fix: auth.uid() -> (select auth.uid()))
CREATE POLICY "Brugere kan opdatere egen profil"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id OR public.is_admin())
  WITH CHECK ((select auth.uid()) = id OR public.is_admin());

-- DELETE
DROP POLICY IF EXISTS "Ingen kan slette profiler" ON public.profiles;
CREATE POLICY "Ingen kan slette profiler"
  ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- -----------------------------------------------------------------------------
-- B) matches: merge admin adgang i action-specifikke policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS matches_admin_all ON public.matches;

DROP POLICY IF EXISTS "Autentificerede kan oprette kampe" ON public.matches;
DROP POLICY IF EXISTS "Matches insertable" ON public.matches;
CREATE POLICY "Autentificerede kan oprette kampe"
  ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    (creator_id = (select auth.uid()) AND NOT public.is_banned())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Alle kan se kampe" ON public.matches;
CREATE POLICY "Alle kan se kampe"
  ON public.matches
  FOR SELECT TO authenticated
  USING (true OR public.is_admin());

DROP POLICY IF EXISTS "Opretteren kan slette sin kamp" ON public.matches;
CREATE POLICY "Opretteren kan slette sin kamp"
  ON public.matches
  FOR DELETE TO authenticated
  USING (creator_id = (select auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS matches_update_by_creator_or_participant ON public.matches;
CREATE POLICY matches_update_by_creator_or_participant
  ON public.matches
  FOR UPDATE TO authenticated
  USING (
    creator_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.match_players mp
      WHERE mp.match_id = matches.id
        AND mp.user_id = (select auth.uid())
    )
    OR public.is_admin()
  )
  WITH CHECK (
    creator_id = (select auth.uid())
    OR public.is_admin()
  );


-- -----------------------------------------------------------------------------
-- C) match_results: merge admin adgang i action-specifikke policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS match_results_admin_all ON public.match_results;

DROP POLICY IF EXISTS "Deltagere kan indsende resultater" ON public.match_results;
CREATE POLICY "Deltagere kan indsende resultater"
  ON public.match_results
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.match_players mp
        WHERE mp.match_id = match_results.match_id
          AND mp.user_id = (select auth.uid())
      )
      AND submitted_by = (select auth.uid())
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Alle kan se resultater" ON public.match_results;
CREATE POLICY "Alle kan se resultater"
  ON public.match_results
  FOR SELECT TO authenticated
  USING (true OR public.is_admin());

DROP POLICY IF EXISTS match_results_update_by_participant ON public.match_results;
CREATE POLICY match_results_update_by_participant
  ON public.match_results
  FOR UPDATE TO authenticated
  USING (
    submitted_by = (select auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    submitted_by = (select auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Indsenderen kan slette afviste resultater" ON public.match_results;
CREATE POLICY "Indsenderen kan slette afviste resultater"
  ON public.match_results
  FOR DELETE TO authenticated
  USING (
    submitted_by = (select auth.uid())
    OR public.is_admin()
  );


-- -----------------------------------------------------------------------------
-- D) elo_history: fjern FOR ALL admin policy og merge pr. action
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS elo_history_admin_all ON public.elo_history;

DROP POLICY IF EXISTS "Alle kan se ELO-historik" ON public.elo_history;
DROP POLICY IF EXISTS elo_history_select_authenticated ON public.elo_history;
CREATE POLICY elo_history_select_authenticated
  ON public.elo_history
  FOR SELECT TO authenticated
  USING (true OR public.is_admin());

DROP POLICY IF EXISTS elo_history_no_insert ON public.elo_history;
CREATE POLICY elo_history_no_insert
  ON public.elo_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS elo_history_no_update ON public.elo_history;
CREATE POLICY elo_history_no_update
  ON public.elo_history
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS elo_history_no_delete ON public.elo_history;
CREATE POLICY elo_history_no_delete
  ON public.elo_history
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- -----------------------------------------------------------------------------
-- E) match_players: saml to DELETE policies i én
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Brugere kan afmelde sig selv" ON public.match_players;
DROP POLICY IF EXISTS "Creators can remove all players from own match" ON public.match_players;
CREATE POLICY match_players_delete_self_or_creator
  ON public.match_players
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_players.match_id
        AND m.creator_id = (select auth.uid())
    )
    OR public.is_admin()
  );


-- -----------------------------------------------------------------------------
-- F) americano_participants: saml creator + self delete i én policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS americano_participants_delete ON public.americano_participants;
DROP POLICY IF EXISTS americano_participants_creator_delete ON public.americano_participants;
CREATE POLICY americano_participants_delete
  ON public.americano_participants
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.americano_tournaments t
      WHERE t.id = americano_participants.tournament_id
        AND t.creator_id = (select auth.uid())
        AND t.status = 'registration'
    )
    OR public.is_admin()
  );
