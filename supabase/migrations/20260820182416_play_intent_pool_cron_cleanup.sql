/**
 * Oprydning efter udløbne forslag. Køres af pg_cron hvert 15. minut.
 *
 * Bemærk skellet mellem de to grupper: den der nåede at sige ja er stadig
 * interesseret og skal tilbage i puljen, mens den der aldrig svarede tages
 * helt ud. Uden det skel ville næste kørsel danne præcis samme døde gruppe
 * igen — inklusive den spiller, der ikke reagerede.
 */
CREATE OR REPLACE FUNCTION public.expire_stale_play_intents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_proposals integer := 0;
  v_reopened integer := 0;
  v_ghosted integer := 0;
  v_intents integer := 0;
  v_seed uuid;
  v_formed jsonb := NULL;
BEGIN
  WITH stale AS (
    UPDATE public.match_proposals
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at <= now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_proposals FROM stale;

  WITH back AS (
    UPDATE public.play_intents i
    SET status = 'open', proposal_id = NULL
    FROM public.match_proposal_members m
    JOIN public.match_proposals p ON p.id = m.proposal_id
    WHERE m.intent_id = i.id
      AND i.status = 'proposed'
      AND p.status = 'expired'
      AND m.response = 'accepted'
    RETURNING i.id
  )
  SELECT COUNT(*) INTO v_reopened FROM back;

  WITH ghosts AS (
    UPDATE public.play_intents i
    SET status = 'cancelled', proposal_id = NULL
    FROM public.match_proposal_members m
    JOIN public.match_proposals p ON p.id = m.proposal_id
    WHERE m.intent_id = i.id
      AND i.status = 'proposed'
      AND p.status = 'expired'
      AND m.response <> 'accepted'
    RETURNING i.id
  )
  SELECT COUNT(*) INTO v_ghosted FROM ghosts;

  WITH gone AS (
    UPDATE public.play_intents
    SET status = 'expired'
    WHERE status IN ('open', 'proposed')
      AND play_date < (now() AT TIME ZONE 'Europe/Copenhagen')::date
    RETURNING id
  )
  SELECT COUNT(*) INTO v_intents FROM gone;

  -- Selvhelbredende: de frigivne skal ikke vente på at en ny bruger dukker op.
  IF v_reopened > 0 THEN
    SELECT id INTO v_seed
    FROM public.play_intents
    WHERE status = 'open'
      AND play_date >= (now() AT TIME ZONE 'Europe/Copenhagen')::date
    ORDER BY created_at
    LIMIT 1;

    IF v_seed IS NOT NULL THEN
      v_formed := public.try_form_match_proposal(v_seed);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'proposals_expired', v_proposals,
    'intents_reopened', v_reopened,
    'intents_ghosted', v_ghosted,
    'intents_expired', v_intents,
    'reformed', v_formed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_stale_play_intents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_play_intents() TO authenticated;

-- Ren SQL uden HTTP, så den planlægges direkte — samme mønster som
-- 'auto-confirm-expired-results'.
DO $$
BEGIN
  PERFORM cron.unschedule('expire-play-intents');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'expire-play-intents',
  '*/15 * * * *',
  'SELECT public.expire_stale_play_intents()'
);
