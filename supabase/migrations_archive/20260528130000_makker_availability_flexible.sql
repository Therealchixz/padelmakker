-- Flexibel i makker-filter = alle tidsrum (samme som tom availability).

CREATE OR REPLACE FUNCTION public.makker_filter_availability_overlap(p_filter jsonb, p_subject text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_filter IS NULL OR jsonb_array_length(p_filter) = 0 THEN true
    WHEN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_filter) AS f(slot)
      WHERE lower(trim(f.slot)) = 'flexibel'
    ) THEN true
    WHEN p_subject IS NULL OR array_length(p_subject, 1) IS NULL OR array_length(p_subject, 1) = 0 THEN true
    ELSE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(p_filter) AS f(slot)
      WHERE lower(trim(f.slot)) = ANY (
        SELECT lower(trim(x)) FROM unnest(p_subject) AS x
      )
    )
  END;
$$;
