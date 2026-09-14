-- App-audit: stop dobbelt-push, forkerte nudges og spøgelses-kampe.
-- After an in-app match_proposal row is written, ring the phone via
-- dispatch-push. The 4th player may close the tab; the other three are
-- typically not in the app at all.

CREATE OR REPLACE FUNCTION public.notifications_dispatch_match_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF NEW.type = 'match_proposal' THEN
    PERFORM public.dispatch_push_to_user(
      NEW.user_id,
      NEW.title,
      NEW.body,
      NEW.type,
      NEW.entity_type,
      NEW.entity_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notifications_dispatch_match_proposal ON public.notifications;
CREATE TRIGGER notifications_dispatch_match_proposal
AFTER INSERT ON public.notifications
FOR EACH ROW
WHEN (NEW.type = 'match_proposal')
EXECUTE FUNCTION public.notifications_dispatch_match_proposal();

REVOKE ALL ON FUNCTION public.notifications_dispatch_match_proposal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notifications_dispatch_match_proposal() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.expire_abandoned_in_progress_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.matches mt
  SET status = 'cancelled',
      seeking_player = false
  WHERE mt.status = 'in_progress'
    AND mt.time ~ '^\d{1,2}:\d{2}'
    AND NOT EXISTS (SELECT 1 FROM public.match_results r WHERE r.match_id = mt.id)
    AND (
      CASE
        WHEN mt.time_end ~ '^\d{1,2}:\d{2}'
          THEN ((mt.date::text || ' ' || mt.time_end)::timestamp AT TIME ZONE 'Europe/Copenhagen')
        ELSE ((mt.date::text || ' ' || coalesce(nullif(mt.time, ''), '00:00'))::timestamp
              AT TIME ZONE 'Europe/Copenhagen') + interval '90 minutes'
      END
    ) < now() - interval '48 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_abandoned_in_progress_matches() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_abandoned_in_progress_matches() TO service_role;
