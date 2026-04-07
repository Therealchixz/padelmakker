-- =============================================================================
-- Performance Advisor: RLS (Lint 0003 + 0006)
-- =============================================================================
-- Kør i Supabase → SQL Editor.
--
-- Problem A — multiple_permissive_policies (0006)
--   I har ofte BÅDE engelsk- OG dansk-navngivne policies med samme formål.
--   Postgres evaluerer ALLE permissive policies pr. rolle/handling → langsommere.
--   Løsning: behold ÉN policy pr. (tabel, kommando, hensigt). Her fjernes de
--   engelske navne der matcher par fra jeres advisor-udskrift.
--
-- Problem B — auth_rls_initplan (0003)
--   I USING / WITH CHECK: skriv (select auth.uid()) i stedet for auth.uid()
--   (samme for auth.jwt(), auth.role(), current_setting(...) når det bruges i RLS).
--   Se: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
--   Denne fil retter IKKE automatisk alle udtryk (kræver jeres præcise SQL).
--   Efter DEL 1: eksporter policies og ret manuelt ELLER brug Dashboard → Authentication →
--   erstat i hver policy. Brug forespørgslen under DEL 2 til at se qual/with_check.
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

-- OBS match_players DELETE: Efter drop af "Can leave match" kan I stadig have
-- to DELETE-policies (afmelding + opretter fjerner spillere). Linter kan stadig
-- klage — så merge til ÉN policy med OR i USING, eller accepter warning.


-- ─── DEL 2: Liste alle public RLS policies (kopier qual/with_check ind i editor og ret) ───

-- Kør denne SELECT alene; ret derefter hver policy i Dashboard eller med
-- DROP POLICY + CREATE POLICY hvor auth.uid() → (select auth.uid()) osv.

-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;


-- ─── DEL 3: Eksempel på initplan-fix (skabelon — tilpas til jeres kolonnenavne) ───

-- Før (langsom pr. række):
--   USING (auth.uid() = user_id)
-- Efter:
--   USING ((select auth.uid()) = user_id)

-- Før:
--   WITH CHECK (auth.uid() = id)
-- Efter:
--   WITH CHECK ((select auth.uid()) = id)
