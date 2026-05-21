-- Realistisk padel-tolerance: max ±0,5 (0,3–0,4 mærkes allerede tydeligt på banen).

CREATE OR REPLACE FUNCTION public.match_filter_level_window_from_prefs(p_prefs jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0.1, LEAST(0.5,
    COALESCE(
      NULLIF(trim(p_prefs->>'levelWindow'), '')::numeric,
      CASE
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 175 THEN 0.2
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 275 THEN 0.3
        WHEN COALESCE((p_prefs->>'eloWindow')::integer, 0) <= 350 THEN 0.4
        ELSE 0.5
      END,
      0.2
    )
  ));
$$;
