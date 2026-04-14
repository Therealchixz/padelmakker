-- =============================================================================
-- Performance Advisor: RLS (Lint 0003 + 0006)
-- =============================================================================
-- Kør i Supabase → SQL Editor.
--
-- Problem A — multiple_permissive_policies (0006)
--   I har ofte BÅDE engelsk- OG dansk-navngivne policies med samme formål.
--   Postgres evaluerer ALLE permissive policies pr. rolle/handling → langsommere.
--   Løsning: behold ÉN policy pr. (tabel, kommando, hensigt).
--
-- Problem B — auth_rls_initplan (0003)
--   I USING / WITH CHECK: skriv (select auth.uid()) i stedet for auth.uid()
--   (samme idé for auth.jwt(), auth.role(), current_setting(...) i RLS).
--   Se: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- =============================================================================

-- ─── DEL 1: Fjern engelske dubletter (behold danske "Brugere / Alle kan / …") ───

DROP POLICY IF EXISTS "Users see own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated can book" ON public.bookings;

DROP POLICY IF EXISTS "Slots viewable by everyone" ON public.court_slots;

DROP POLICY IF EXISTS "Courts viewable by everyone" ON public.courts;

DROP POLICY IF EXISTS "ELO history viewable" ON public.elo_history;

DROP POLICY IF EXISTS "Authenticated can join" ON public.match_players;
DROP POLICY IF EXISTS "Can leave match" ON public.match_players;
DROP POLICY IF EXISTS "Match players viewable" ON public.match_players;
-- Behold evt. "Creators can remove all players from own match" hvis I ikke har dansk tilsvarende.

DROP POLICY IF EXISTS "Authenticated can submit" ON public.match_results;
DROP POLICY IF EXISTS "Results viewable" ON public.match_results;

DROP POLICY IF EXISTS "Authenticated can create matches" ON public.matches;
DROP POLICY IF EXISTS "Matches viewable by everyone" ON public.matches;
DROP POLICY IF EXISTS "Creators can delete own matches" ON public.matches;

DROP POLICY IF EXISTS "Authenticated can send" ON public.messages;
DROP POLICY IF EXISTS "Users see own messages" ON public.messages;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;

-- Valgfrit hvis I stadig har 2× "alle må læse profiler" efter ovenstående:
-- DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
-- (Fjern kommentar kun hvis qual matcher "Alle kan læse profiler" — tjek DEL 2 først.)


-- ─── DEL 2: Find policies der stadig bruger auth.uid() uden SELECT ───

-- Kør denne SELECT alene for at finde kandidater til initplan-fix.
-- Brug resultatet til at lave DROP POLICY + CREATE POLICY med samme logik,
-- men skift auth.uid() → (select auth.uid()).

-- SELECT schemaname,
--        tablename,
--        policyname,
--        cmd,
--        qual,
--        with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (
--     coalesce(qual, '') ILIKE '%auth.uid()%'
--     OR coalesce(with_check, '') ILIKE '%auth.uid()%'
--   )
-- ORDER BY tablename, policyname;


-- ─── DEL 3: Skabeloner til hurtig re-create med initplan-fix ───

-- Eksempel A: profiles_update_own
-- DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
-- CREATE POLICY profiles_update_own
--   ON public.profiles
--   FOR UPDATE
--   TO authenticated
--   USING ((select auth.uid()) = id OR public.is_admin())
--   WITH CHECK ((select auth.uid()) = id OR public.is_admin());

-- Eksempel B: matches_delete_creator_or_admin
-- DROP POLICY IF EXISTS matches_delete_creator_or_admin ON public.matches;
-- CREATE POLICY matches_delete_creator_or_admin
--   ON public.matches
--   FOR DELETE
--   TO authenticated
--   USING (
--     (select auth.uid()) = creator_id
--     OR public.is_admin()
--   );


-- ─── DEL 4: Match players DELETE (samlet policy i stedet for to permissive) ───

-- Brug denne hvis linter stadig klager på match_players DELETE.
-- Idé: saml "spiller melder sig selv af" + "opretter fjerner spiller" i ÉN policy.

-- DROP POLICY IF EXISTS match_players_delete_self ON public.match_players;
-- DROP POLICY IF EXISTS "Can leave match" ON public.match_players;
-- DROP POLICY IF EXISTS "Creators can remove all players from own match" ON public.match_players;
--
-- CREATE POLICY match_players_delete_self_or_creator
--   ON public.match_players
--   FOR DELETE
--   TO authenticated
--   USING (
--     (select auth.uid()) = user_id
--     OR EXISTS (
--       SELECT 1
--       FROM public.matches m
--       WHERE m.id = match_players.match_id
--         AND m.creator_id = (select auth.uid())
--     )
--   );
