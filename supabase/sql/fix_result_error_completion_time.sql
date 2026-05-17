-- =============================================================================
-- Fejlindberetning: 24t fra faktisk afslutning (resultat), ikke oprettelsesdato
-- Kør i Supabase → SQL Editor (efter feature_result_error_reports.sql)
-- =============================================================================

CREATE OR REPLACE FUNCTION public._result_error_entity_completed_at(
  p_source_type text,
  p_entity_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz;
  v_created timestamptz;
BEGIN
  IF p_source_type = 'match_2v2' THEN
    SELECT max(greatest(mr.updated_at, mr.created_at))
    INTO v_ts
    FROM public.match_results mr
    WHERE mr.match_id = p_entity_id
      AND mr.confirmed = true;

    IF v_ts IS NOT NULL THEN
      RETURN v_ts;
    END IF;

    SELECT m.completed_at, m.created_at
    INTO v_ts, v_created
    FROM public.matches m
    WHERE m.id = p_entity_id;

    IF v_ts IS NOT NULL AND (v_created IS NULL OR v_ts > v_created + interval '1 minute') THEN
      RETURN v_ts;
    END IF;

    SELECT (m.date::text || ' ' || coalesce(nullif(trim(m.time::text), ''), '12:00'))::timestamptz
    INTO v_ts
    FROM public.matches m
    WHERE m.id = p_entity_id AND m.date IS NOT NULL;

    RETURN v_ts;
  ELSIF p_source_type = 'americano' THEN
    SELECT coalesce(t.updated_at, t.created_at)
    INTO v_ts
    FROM public.americano_tournaments t
    WHERE t.id = p_entity_id;
  ELSIF p_source_type = 'league' THEN
    SELECT coalesce(l.updated_at, l.end_date::timestamptz, l.created_at)
    INTO v_ts
    FROM public.leagues l
    WHERE l.id = p_entity_id;
  END IF;

  RETURN v_ts;
END;
$$;

REVOKE ALL ON FUNCTION public._result_error_entity_completed_at(text, uuid) FROM PUBLIC;

-- Ret completed_at for afsluttede kampe hvor den blev backfill'et til created_at
UPDATE public.matches m
SET completed_at = sub.finished_at
FROM (
  SELECT
    m2.id,
    coalesce(
      (
        SELECT max(greatest(mr.updated_at, mr.created_at))
        FROM public.match_results mr
        WHERE mr.match_id = m2.id
          AND mr.confirmed = true
      ),
      (m2.date::text || ' ' || coalesce(nullif(trim(m2.time::text), ''), '12:00'))::timestamptz
    ) AS finished_at
  FROM public.matches m2
  WHERE m2.status = 'completed'
    AND (
      m2.completed_at IS NULL
      OR m2.completed_at <= m2.created_at + interval '1 minute'
    )
) sub
WHERE m.id = sub.id
  AND sub.finished_at IS NOT NULL;
