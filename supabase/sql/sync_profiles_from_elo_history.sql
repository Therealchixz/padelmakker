-- =============================================================================
-- Synkroniser profiles.elo_rating, games_played, games_won med elo_history
-- =============================================================================
-- Kør i Supabase: SQL Editor (eller som migration).
--
-- FORUDSÆTNINGER (tilpas hvis dit skema afviger):
--   public.profiles: id (uuid), elo_rating, games_played, games_won
--   public.elo_history: user_id, match_id, old_rating, new_rating, result, date
--                     + helst en unik kolonne til tie-break (fx id) i ORDER BY
--
-- LOGIK (samme som app’en):
--   Kun rækker hvor old_rating IS NOT NULL AND match_id IS NOT NULL
--   Seneste ELO = COALESCE(new_rating, old_rating) på seneste række (date, id)
--   games_played = antal sådanne rækker
--   games_won    = antal hvor result (case-insensitive) = 'win'
--
-- TRIN:
--   1) Kør hele scriptet én gang.
--   2) Hvis fejl på ORDER BY: fjern ", e.id DESC NULLS LAST" overalt hvis elo_history ikke har id.
--   3) Hvis fejl på kolonnenavne: ret til dit rigtige skema.
--   4) Trigger-syntaks: Supabase bruger typisk PG14+. Hvis CREATE TRIGGER fejler, prøv
--      "EXECUTE FUNCTION ..." i stedet for "EXECUTE PROCEDURE ..." (nyere PG).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) Funktion: genberegn én bruger fra elo_history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles AS p
  SET
    elo_rating = COALESCE(
      (
        SELECT ROUND(COALESCE(e.new_rating, e.old_rating, 1000)::numeric)::int
        FROM public.elo_history AS e
        WHERE e.user_id = p_user_id
          AND e.old_rating IS NOT NULL
          AND e.match_id IS NOT NULL
        ORDER BY e.date DESC NULLS LAST, e.id DESC NULLS LAST
        LIMIT 1
      ),
      1000
    ),
    games_played = COALESCE(
      (
        SELECT COUNT(*)::int
        FROM public.elo_history AS e
        WHERE e.user_id = p_user_id
          AND e.old_rating IS NOT NULL
          AND e.match_id IS NOT NULL
      ),
      0
    ),
    games_won = COALESCE(
      (
        SELECT COUNT(*)::int
        FROM public.elo_history AS e
        WHERE e.user_id = p_user_id
          AND e.old_rating IS NOT NULL
          AND e.match_id IS NOT NULL
          AND lower(COALESCE(e.result, '')) = 'win'
      ),
      0
    )
  WHERE p.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) IS
  'Sætter profiles.elo_rating / games_* ud fra rated elo_history-rækker (matcher PadelMakker-appen).';


-- -----------------------------------------------------------------------------
-- 2) Engangskørsel: ret alle profiler der har elo_history
-- -----------------------------------------------------------------------------
WITH rated AS (
  SELECT *
  FROM public.elo_history
  WHERE old_rating IS NOT NULL
    AND match_id IS NOT NULL
),
latest AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    ROUND(COALESCE(new_rating, old_rating, 1000)::numeric)::int AS elo
  FROM rated
  ORDER BY user_id, date DESC NULLS LAST, id DESC NULLS LAST
),
cnt AS (
  SELECT
    user_id,
    COUNT(*)::int AS games,
    COUNT(*) FILTER (
      WHERE lower(COALESCE(result, '')) = 'win'
    )::int AS wins
  FROM rated
  GROUP BY user_id
)
UPDATE public.profiles AS p
SET
  elo_rating   = l.elo,
  games_played = c.games,
  games_won    = c.wins
FROM latest AS l
JOIN cnt AS c ON c.user_id = l.user_id
WHERE p.id = l.user_id;


-- -----------------------------------------------------------------------------
-- 3) Fremtidig synk: trigger ved ændringer i elo_history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_elo_history_sync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  IF tg_op = 'DELETE' THEN
    uid := old.user_id;
  ELSE
    uid := new.user_id;
  END IF;

  IF uid IS NOT NULL THEN
    PERFORM public.recalc_profile_stats_from_elo_history(uid);
  END IF;

  IF tg_op = 'DELETE' THEN
    RETURN old;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS elo_history_sync_profile ON public.elo_history;

CREATE TRIGGER elo_history_sync_profile
AFTER INSERT OR UPDATE OR DELETE ON public.elo_history
FOR EACH ROW
EXECUTE PROCEDURE public.trg_elo_history_sync_profile();


-- -----------------------------------------------------------------------------
-- Valgfrit: giv authenticated lov til at kalde genberegning (fx fra Edge Function)
-- -----------------------------------------------------------------------------
-- GRANT EXECUTE ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) TO service_role;


-- =============================================================================
-- Valgfrit: ret inde i apply_elo_for_match
-- =============================================================================
-- Hvis din RPC allerede opdaterer profiles forkert, kan du tilføje til SLUTNINGEN
-- (for hver berørt user_id):
--   PERFORM public.recalc_profile_stats_from_elo_history(user_uuid);
-- Så stemmer DB uanset gammel logik. Triggeren ovenfor gør det som regel overflødigt
-- for INSERT/UPDATE/DELETE på elo_history — men ikke hvis ELO kun ændres andre steder.
-- =============================================================================
