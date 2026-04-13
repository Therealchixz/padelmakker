-- =============================================================================
-- Americano: separat W/L-statistik (påvirker IKKE ELO / elo_history)
-- Kør efter americano_schema.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS americano_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS americano_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS americano_draws integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_americano_profile_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  w int;
  l int;
  d int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO w
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score <> m.team_b_score
    AND (
      (
        EXISTS (
          SELECT 1 FROM public.americano_participants p
          WHERE p.user_id = p_user_id AND p.id IN (m.team_a_p1, m.team_a_p2)
        )
        AND m.team_a_score > m.team_b_score
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM public.americano_participants p
          WHERE p.user_id = p_user_id AND p.id IN (m.team_b_p1, m.team_b_p2)
        )
        AND m.team_b_score > m.team_a_score
      )
    );

  SELECT COUNT(*)::int INTO l
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score <> m.team_b_score
    AND (
      (
        EXISTS (
          SELECT 1 FROM public.americano_participants p
          WHERE p.user_id = p_user_id AND p.id IN (m.team_a_p1, m.team_a_p2)
        )
        AND m.team_b_score > m.team_a_score
      )
      OR
      (
        EXISTS (
          SELECT 1 FROM public.americano_participants p
          WHERE p.user_id = p_user_id AND p.id IN (m.team_b_p1, m.team_b_p2)
        )
        AND m.team_a_score > m.team_b_score
      )
    );

  SELECT COUNT(*)::int INTO d
  FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL
    AND m.team_b_score IS NOT NULL
    AND m.team_a_score = m.team_b_score
    AND (
      EXISTS (
        SELECT 1 FROM public.americano_participants p
        WHERE p.user_id = p_user_id AND p.id IN (m.team_a_p1, m.team_a_p2)
      )
      OR
      EXISTS (
        SELECT 1 FROM public.americano_participants p
        WHERE p.user_id = p_user_id AND p.id IN (m.team_b_p1, m.team_b_p2)
      )
    );

  UPDATE public.profiles
  SET
    americano_wins = COALESCE(w, 0),
    americano_losses = COALESCE(l, 0),
    americano_draws = COALESCE(d, 0)
  WHERE id = p_user_id;
END;
$$;

-- Trigger-funktion: kører som STATEMENT (ikke per-række) for at undgå N+1-storm
-- ved bulk-insert af runder. Bruger transition-tabel "changed_rows".
CREATE OR REPLACE FUNCTION public.trg_americano_match_recalc_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid;
BEGIN
  FOR uid IN
    SELECT DISTINCT ap.user_id
    FROM public.americano_participants ap
    WHERE ap.tournament_id IN (
      SELECT DISTINCT tournament_id FROM changed_rows
    )
  LOOP
    PERFORM public.recalc_americano_profile_stats(uid);
  END LOOP;
  RETURN NULL;
END;
$$;

-- Fjern alle gamle triggers (per-række og statement)
DROP TRIGGER IF EXISTS trg_americano_matches_recalc ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_ins_upd ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_ins ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_upd ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_del ON public.americano_matches;

-- PostgreSQL kræver separate triggers pr. event når transition tables bruges
CREATE TRIGGER trg_americano_matches_recalc_ins
  AFTER INSERT ON public.americano_matches
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_americano_match_recalc_stats();

CREATE TRIGGER trg_americano_matches_recalc_upd
  AFTER UPDATE ON public.americano_matches
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_americano_match_recalc_stats();

CREATE TRIGGER trg_americano_matches_recalc_del
  AFTER DELETE ON public.americano_matches
  REFERENCING OLD TABLE AS changed_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trg_americano_match_recalc_stats();

REVOKE ALL ON FUNCTION public.recalc_americano_profile_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_americano_match_recalc_stats() FROM PUBLIC;
