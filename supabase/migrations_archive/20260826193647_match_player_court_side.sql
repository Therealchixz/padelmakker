-- Venstre/højre-side på 2v2-kampe (match_players.court_side).
-- Auto-udfylde ved tilmelding; spillere/opretter kan bytte via RPC.

ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS court_side text;

ALTER TABLE public.match_players
  DROP CONSTRAINT IF EXISTS match_players_court_side_check;

ALTER TABLE public.match_players
  ADD CONSTRAINT match_players_court_side_check
  CHECK (court_side IS NULL OR court_side IN ('left', 'right'));

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY match_id, team
      ORDER BY joined_at NULLS LAST, id
    ) AS rn
  FROM public.match_players
  WHERE team IN (1, 2)
    AND court_side IS NULL
)
UPDATE public.match_players mp
SET court_side = CASE WHEN r.rn = 1 THEN 'left' WHEN r.rn = 2 THEN 'right' ELSE NULL END
FROM ranked r
WHERE mp.id = r.id;

ALTER TABLE public.match_players
  DROP CONSTRAINT IF EXISTS match_players_unique_team_side;

ALTER TABLE public.match_players
  ADD CONSTRAINT match_players_unique_team_side
  UNIQUE (match_id, team, court_side)
  DEFERRABLE INITIALLY IMMEDIATE;
