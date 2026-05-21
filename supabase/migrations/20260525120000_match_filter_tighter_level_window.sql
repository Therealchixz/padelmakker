-- Snævrere niveau-tolerance i kamp-filter (±0,2–1,0, standard ±0,3).

CREATE OR REPLACE FUNCTION public.match_filter_level_window_from_prefs(p_prefs jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0.15, LEAST(1.5,
    COALESCE(
      NULLIF(trim(p_prefs->>'levelWindow'), '')::numeric,
      CASE
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 175 THEN 0.3
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 275 THEN 0.5
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 350 THEN 0.7
        ELSE 1.0
      END,
      0.3
    )
  ));
$$;
