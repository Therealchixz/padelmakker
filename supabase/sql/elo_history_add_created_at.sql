-- =============================================================================
-- Tilføj created_at til elo_history så aktivitetsfeedet kan sortere korrekt
-- (date-kolonnen har kun dag-præcision — ikke klokkeslæt — og er ubrugelig
-- som tiebreaker når flere kampe afspilles samme dag).
--
-- Kør i Supabase → SQL Editor.
-- =============================================================================

-- 1) Tilføj kolonnen med default now() (nye rækker får tidsstempel automatisk)
ALTER TABLE public.elo_history
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2) Sæt eksisterende rækker til midnat på matchdatoen
--    (bedre end null — giver den rigtige dag selv om klokkeslæt er ukorrekt)
UPDATE public.elo_history
SET created_at = date::timestamptz
WHERE created_at IS NULL;
