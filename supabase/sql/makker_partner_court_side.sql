-- Eksplicit partnerCourtSide (venstre / hojre / any) i stedet for courtSideMode.

CREATE OR REPLACE FUNCTION public.makker_filter_resolve_partner_court_side(
  p_prefs jsonb,
  p_watcher_court_side text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(trim(p_prefs->>'partnerCourtSide'), '') IN ('venstre', 'hojre', 'any')
      THEN trim(p_prefs->>'partnerCourtSide')
    WHEN COALESCE(NULLIF(trim(p_prefs->>'courtSideMode'), ''), 'complementary') = 'any' THEN 'any'
    WHEN trim(p_prefs->>'courtSideMode') = 'same' THEN
      CASE public.makker_filter_normalize_side(p_watcher_court_side)
        WHEN 'venstre' THEN 'venstre'
        WHEN 'hojre' THEN 'hojre'
        ELSE 'any'
      END
    WHEN public.makker_filter_normalize_side(p_watcher_court_side) = 'venstre' THEN 'hojre'
    WHEN public.makker_filter_normalize_side(p_watcher_court_side) = 'hojre' THEN 'venstre'
    ELSE 'any'
  END;
$$;

CREATE OR REPLACE FUNCTION public.makker_filter_partner_court_side_ok(
  p_prefs jsonb,
  p_watcher_court_side text,
  p_subject_court_side text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE public.makker_filter_resolve_partner_court_side(p_prefs, p_watcher_court_side)
    WHEN 'any' THEN true
    ELSE (
      public.makker_filter_normalize_side(p_subject_court_side) = ''
      OR public.makker_filter_normalize_side(p_subject_court_side) = 'begge'
      OR public.makker_filter_normalize_side(p_subject_court_side)
        = public.makker_filter_resolve_partner_court_side(p_prefs, p_watcher_court_side)
    )
  END;
$$;
