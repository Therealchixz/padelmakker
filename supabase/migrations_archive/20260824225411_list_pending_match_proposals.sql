-- Ja/nej-popuppen skal vise de tre andre spillere. Klienten kan ikke joine
-- match_proposal_members (RLS er kun egne rækker), så navnene hentes her.

CREATE OR REPLACE FUNCTION public.list_pending_match_proposals()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x))
    FROM (
      SELECT
        p.id,
        p.play_date,
        p.start_time,
        p.end_time,
        p.region,
        p.status,
        p.expires_at,
        (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', m.user_id,
            'name', COALESCE(NULLIF(btrim(pr.full_name), ''), NULLIF(btrim(pr.name), ''), 'Spiller'),
            'avatar', COALESCE(NULLIF(btrim(pr.avatar), ''), NULLIF(btrim(pr.avatar_emoji), ''), '🎾'),
            'level', pr.level,
            'response', m.response,
            'is_me', m.user_id = v_caller
          ) ORDER BY (m.user_id = v_caller) DESC, lower(COALESCE(pr.full_name, pr.name, ''))), '[]'::jsonb)
          FROM public.match_proposal_members m
          JOIN public.profiles pr ON pr.id = m.user_id
          WHERE m.proposal_id = p.id
        ) AS members
      FROM public.match_proposals p
      JOIN public.match_proposal_members mine
        ON mine.proposal_id = p.id AND mine.user_id = v_caller
      WHERE p.status = 'pending'
        AND p.expires_at > now()
        AND mine.response = 'pending'
      ORDER BY p.expires_at
    ) x
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_pending_match_proposals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_pending_match_proposals() TO authenticated;
