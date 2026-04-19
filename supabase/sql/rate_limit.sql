-- Distribueret rate limiting på tværs af Vercel-containere.
-- Kør i Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  key          TEXT    NOT NULL,
  window_start BIGINT  NOT NULL,
  hits         INT     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Ingen RLS-policies: service role bypasser RLS, andre brugere har ingen adgang.

-- Atomisk tjek + inkrement. Rydder automatisk op i udløbne vinduer.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key          TEXT,
  p_window_start BIGINT,
  p_max          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hits INT;
BEGIN
  -- Slet vinduer ældre end forrige vindue (holder max 2 rækker pr. nøgle)
  DELETE FROM rate_limit_hits
  WHERE key = p_key AND window_start < p_window_start - 1;

  -- Indsæt eller inkrementer atomisk
  INSERT INTO rate_limit_hits (key, window_start, hits)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET hits = rate_limit_hits.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_max;
END;
$$;
