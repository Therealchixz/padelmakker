-- Performance: Supabase advisor 'auth_rls_initplan' flagede 40 policies der
-- kalder auth.uid() pr. række. Wrap i (SELECT auth.uid()) så planneren
-- evaluerer den én gang pr. query (initplan) i stedet for pr. række.
-- Idempotent: allerede-wrappede forekomster beskyttes med placeholder.
DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        replace(coalesce(qual, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%'
        OR replace(coalesce(with_check, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%'
      )
  LOOP
    new_qual := replace(pol.qual, '( SELECT auth.uid() AS uid)', '@@WRAPPED@@');
    new_qual := replace(new_qual, 'auth.uid()', '(SELECT auth.uid())');
    new_qual := replace(new_qual, '@@WRAPPED@@', '( SELECT auth.uid() AS uid)');

    new_check := replace(pol.with_check, '( SELECT auth.uid() AS uid)', '@@WRAPPED@@');
    new_check := replace(new_check, 'auth.uid()', '(SELECT auth.uid())');
    new_check := replace(new_check, '@@WRAPPED@@', '( SELECT auth.uid() AS uid)');

    stmt := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF pol.qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF pol.with_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;

-- Performance: drop duplikerede indexes på league_teams (advisor 'duplicate_index').
-- Behøldte: idx_league_teams_league_id / _player1 / _player2 (identiske definitioner).
DROP INDEX IF EXISTS public.idx_league_teams_league;
DROP INDEX IF EXISTS public.idx_league_teams_p1;
DROP INDEX IF EXISTS public.idx_league_teams_p2;
