-- =============================================================================
-- Supabase Performance Advisor: 0006 (multiple permissive) + 0003 (auth_rls_initplan)
-- =============================================================================
-- Kør ÉN gang i Supabase → SQL Editor (hele filen).
--
-- DEL 1: Fjerner engelske RLS-policies der er dubletter af danske (samme formål).
-- DEL 1b: Slår SELECT på public.profiles for "authenticated" sammen til én policy
--         (fjerner typisk 2–3 overlappende permissive SELECT).
-- DEL 2: ALTER POLICY på alle public-policies der bruger auth.uid/jwt/role i qual eller
--         with_check — erstatter med (select auth.*()) som Supabase anbefaler.
--
-- Efter kørsel: kør Performance Advisor igen.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEL 1: Drop engelske dubletter (behold danske policies)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated can book" ON public.bookings;

DROP POLICY IF EXISTS "Slots viewable by everyone" ON public.court_slots;

DROP POLICY IF EXISTS "Courts viewable by everyone" ON public.courts;

DROP POLICY IF EXISTS "ELO history viewable" ON public.elo_history;

DROP POLICY IF EXISTS "Authenticated can join" ON public.match_players;
DROP POLICY IF EXISTS "Can leave match" ON public.match_players;
DROP POLICY IF EXISTS "Match players viewable" ON public.match_players;

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

-- Ekstra engelske navne (hvis de findes)
DROP POLICY IF EXISTS "Authenticated can book slots" ON public.court_slots;
DROP POLICY IF EXISTS "Receiver can mark read" ON public.messages;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEL 1b: Én SELECT-policy for authenticated på profiles (alle må læse — Find makker / ranking)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
DROP POLICY IF EXISTS "Alle kan læse profiler" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;

CREATE POLICY "profiles_select_all_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEL 2: Wrap auth.uid() / auth.jwt() / auth.role() i (select …) via ALTER POLICY
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._pm_wrap_rls_expr(p_expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF p_expr IS NULL THEN
    RETURN NULL;
  END IF;
  s := p_expr;

  s := replace(s, 'auth.uid()', '(select auth.uid())');
  s := replace(s, 'auth.jwt()', '(select auth.jwt())');
  s := replace(s, 'auth.role()', '(select auth.role())');

  WHILE position('(select (select auth.uid()))' IN s) > 0 LOOP
    s := replace(s, '(select (select auth.uid()))', '(select auth.uid())');
  END LOOP;
  WHILE position('(select (select auth.jwt()))' IN s) > 0 LOOP
    s := replace(s, '(select (select auth.jwt()))', '(select auth.jwt())');
  END LOOP;
  WHILE position('(select (select auth.role()))' IN s) > 0 LOOP
    s := replace(s, '(select (select auth.role()))', '(select auth.role())');
  END LOOP;

  RETURN s;
END;
$$;

DO $$
DECLARE
  pol record;
  q text;
  w text;
  qn text;
  wn text;
  stmt text;
  need_wrap boolean;
BEGIN
  FOR pol IN
    SELECT policyname, tablename, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    q := pol.qual;
    w := pol.with_check;

    need_wrap :=
      (COALESCE(q, '') LIKE '%auth.uid%' OR COALESCE(q, '') LIKE '%auth.jwt%' OR COALESCE(q, '') LIKE '%auth.role%')
      OR (COALESCE(w, '') LIKE '%auth.uid%' OR COALESCE(w, '') LIKE '%auth.jwt%' OR COALESCE(w, '') LIKE '%auth.role%');

    IF NOT need_wrap THEN
      CONTINUE;
    END IF;

    qn := public._pm_wrap_rls_expr(q);
    wn := public._pm_wrap_rls_expr(w);

    IF qn IS NOT DISTINCT FROM q AND wn IS NOT DISTINCT FROM w THEN
      CONTINUE;
    END IF;

    stmt := 'ALTER POLICY ' || quote_ident(pol.policyname) || ' ON public.' || quote_ident(pol.tablename);

    IF qn IS NOT NULL AND wn IS NOT NULL THEN
      stmt := stmt || ' USING (' || qn || ') WITH CHECK (' || wn || ')';
    ELSIF qn IS NOT NULL THEN
      stmt := stmt || ' USING (' || qn || ')';
    ELSIF wn IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || wn || ')';
    ELSE
      CONTINUE;
    END IF;

    EXECUTE stmt || ';';
    RAISE NOTICE 'Opdateret policy % på %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

DROP FUNCTION public._pm_wrap_rls_expr(text);

COMMIT;
