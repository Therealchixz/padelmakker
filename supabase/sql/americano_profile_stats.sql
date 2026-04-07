-- =============================================================================
-- Americano: separat W/L-statistik (påvirker IKKE ELO / elo_history)
-- Kør efter americano_schema.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS americano_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS americano_losses integer NOT NULL DEFAULT 0;

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

  UPDATE public.profiles
  SET americano_wins = COALESCE(w, 0), americano_losses = COALESCE(l, 0)
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_americano_match_recalc_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  tid uuid;
  uid uuid;
BEGIN
  tid := COALESCE(NEW.tournament_id, OLD.tournament_id);
  IF tid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  FOR uid IN
    SELECT DISTINCT p.user_id
    FROM public.americano_participants p
    WHERE p.tournament_id = tid
  LOOP
    PERFORM public.recalc_americano_profile_stats(uid);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_americano_matches_recalc ON public.americano_matches;
CREATE TRIGGER trg_americano_matches_recalc
  AFTER INSERT OR UPDATE OR DELETE
  ON public.americano_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_americano_match_recalc_stats();
-- Ældre Postgres: brug EXECUTE PROCEDURE ... hvis ovenstående fejler.

REVOKE ALL ON FUNCTION public.recalc_americano_profile_stats(uuid) FROM PUBLIC;
