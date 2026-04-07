-- =============================================================================
-- Synkroniser profiles.elo_rating, games_played, games_won med elo_history
-- =============================================================================
-- LOGIK (matcher PadelMakker-appen efter fix):
--   elo_rating = GREATEST(100, første rated rækkes old_rating + SUM(change))
--   Hvis change mangler på en række: brug (new_rating - old_rating) i summen.
--   Kronologi: date ASC, match_id ASC, id ASC (samme som app).
--
-- Kør hele filen i Supabase SQL Editor.
-- Hvis elo_history ikke har id-kolonne: fjern ", e.id ASC" / "e.id DESC" i ORDER BY.
-- Hvis CREATE TRIGGER fejler: prøv EXECUTE FUNCTION i stedet for EXECUTE PROCEDURE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Genberegn én bruger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_first numeric;
  v_delta numeric;
  v_games int;
  v_wins int;
BEGIN
  SELECT COUNT(*)::int INTO v_games
  FROM public.elo_history e
  WHERE e.user_id = p_user_id
    AND e.old_rating IS NOT NULL
    AND e.match_id IS NOT NULL;

  IF v_games IS NULL OR v_games = 0 THEN
    UPDATE public.profiles
    SET elo_rating = 1000, games_played = 0, games_won = 0
    WHERE id = p_user_id;
    RETURN;
  END IF;

  SELECT e.old_rating::numeric INTO v_first
  FROM public.elo_history e
  WHERE e.user_id = p_user_id
    AND e.old_rating IS NOT NULL
    AND e.match_id IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST
  LIMIT 1;

  SELECT COALESCE(SUM(
    CASE
      WHEN e.change IS NOT NULL THEN e.change::numeric
      WHEN e.new_rating IS NOT NULL AND e.old_rating IS NOT NULL
        THEN (e.new_rating - e.old_rating)::numeric
      ELSE 0::numeric
    END
  ), 0) INTO v_delta
  FROM public.elo_history e
  WHERE e.user_id = p_user_id
    AND e.old_rating IS NOT NULL
    AND e.match_id IS NOT NULL;

  SELECT COUNT(*)::int INTO v_wins
  FROM public.elo_history e
  WHERE e.user_id = p_user_id
    AND e.old_rating IS NOT NULL
    AND e.match_id IS NOT NULL
    AND lower(COALESCE(e.result, '')) = 'win';

  UPDATE public.profiles AS p
  SET
    elo_rating = GREATEST(100, ROUND(COALESCE(v_first, 1000) + COALESCE(v_delta, 0))::int),
    games_played = v_games,
    games_won = v_wins
  WHERE p.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) IS
  'profiles.elo_rating = første old_rating + sum(change); matcher app UI.';


-- -----------------------------------------------------------------------------
-- 2) Engangskørsel: alle profiler der har rated elo_history
-- -----------------------------------------------------------------------------
WITH rated AS (
  SELECT
    e.user_id,
    e.old_rating,
    e.new_rating,
    e.change,
    e.result,
    ROW_NUMBER() OVER (
      PARTITION BY e.user_id
      ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST
    ) AS rn_first
  FROM public.elo_history e
  WHERE e.old_rating IS NOT NULL
    AND e.match_id IS NOT NULL
),
first_old AS (
  SELECT user_id, old_rating::numeric AS first_rating
  FROM rated
  WHERE rn_first = 1
),
delta AS (
  SELECT
    user_id,
    COALESCE(SUM(
      CASE
        WHEN change IS NOT NULL THEN change::numeric
        WHEN new_rating IS NOT NULL AND old_rating IS NOT NULL
          THEN (new_rating - old_rating)::numeric
        ELSE 0::numeric
      END
    ), 0) AS total_delta
  FROM rated
  GROUP BY user_id
),
cnt AS (
  SELECT
    user_id,
    COUNT(*)::int AS games,
    COUNT(*) FILTER (WHERE lower(COALESCE(result, '')) = 'win')::int AS wins
  FROM rated
  GROUP BY user_id
)
UPDATE public.profiles AS p
SET
  elo_rating = GREATEST(
    100,
    ROUND(COALESCE(f.first_rating, 1000) + COALESCE(d.total_delta, 0))::int
  ),
  games_played = c.games,
  games_won = c.wins
FROM first_old AS f
JOIN delta AS d ON d.user_id = f.user_id
JOIN cnt AS c ON c.user_id = f.user_id
WHERE p.id = f.user_id;

-- Profiler uden rated historik: stadig 1000 / 0 / 0 (kun hvis du vil nulstille dem eksplicit)
-- UPDATE public.profiles SET elo_rating = 1000, games_played = 0, games_won = 0
-- WHERE id NOT IN (SELECT DISTINCT user_id FROM public.elo_history WHERE old_rating IS NOT NULL AND match_id IS NOT NULL);


-- -----------------------------------------------------------------------------
-- 3) Trigger: hold profiles synket ved ændringer i elo_history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_elo_history_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid;
BEGIN
  IF tg_op = 'DELETE' THEN
    uid := OLD.user_id;
  ELSE
    uid := NEW.user_id;
  END IF;

  IF uid IS NOT NULL THEN
    PERFORM public.recalc_profile_stats_from_elo_history(uid);
  END IF;

  IF tg_op = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS elo_history_sync_profile ON public.elo_history;

CREATE TRIGGER elo_history_sync_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.elo_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_elo_history_sync_profile();
