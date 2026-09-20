-- Når to (eller flere) begge søger makker i samme region og niveau, fortæller
-- systemet dem det. Listen under Makkere viser stadig dem, der ikke blev matchet
-- — fx fordi kun den ene har slået søgning til.

CREATE OR REPLACE FUNCTION public.makker_feed_is_active(
  p_prefs jsonb,
  p_seeking_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF COALESCE((p_prefs->>'feedVisible')::boolean, false) IS NOT TRUE THEN
    RETURN false;
  END IF;
  BEGIN
    v_since := NULLIF(btrim(COALESCE(p_prefs->>'feedVisibleSince', '')), '')::timestamptz;
  EXCEPTION
    WHEN OTHERS THEN
      v_since := NULL;
  END;
  v_since := COALESCE(v_since, p_seeking_at);
  IF v_since IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_since >= (now() - interval '7 days');
END;
$$;

REVOKE ALL ON FUNCTION public.makker_feed_is_active(jsonb, timestamptz) FROM PUBLIC;
