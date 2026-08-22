-- Bro mellem "jeg vil spille" (play_intents) og åbne kampe.
--
-- En hensigt venter ikke kun på tre andre i puljen: den matcher også eksisterende
-- åbne kampe i samme dato/tidsrum/region, og en ny åben kamp notifierer omvendt
-- dem der allerede har meldt sig klar.

CREATE OR REPLACE FUNCTION public.parse_clock_time(p_value text)
RETURNS time
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := btrim(COALESCE(p_value, ''));
  IF v_raw = '' THEN
    RETURN NULL;
  END IF;
  IF v_raw ~ '^\d{1,2}:\d{2}(:\d{2})?' THEN
    RETURN v_raw::time;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.parse_clock_time(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.play_intent_overlaps_match_time(
  p_intent_start time,
  p_intent_end time,
  p_match_time text,
  p_match_time_end text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_start time;
  v_end time;
BEGIN
  IF p_intent_start IS NULL OR p_intent_end IS NULL OR p_intent_end <= p_intent_start THEN
    RETURN false;
  END IF;

  v_start := public.parse_clock_time(p_match_time);
  -- Kamp uden klokkeslæt: overlap på datoen (kalderen filtrerer play_date = match.date).
  IF v_start IS NULL THEN
    RETURN true;
  END IF;

  v_end := public.parse_clock_time(p_match_time_end);
  IF v_end IS NULL OR v_end <= v_start THEN
    v_end := (v_start + interval '90 minutes')::time;
    IF v_end <= v_start THEN
      v_end := time '23:59:59';
    END IF;
  END IF;

  RETURN p_intent_start < v_end AND p_intent_end > v_start;
END;
$$;

REVOKE ALL ON FUNCTION public.play_intent_overlaps_match_time(time, time, text, text) FROM PUBLIC;
