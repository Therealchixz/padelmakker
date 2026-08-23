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
  IF NEW.type IN ('match_proposal', 'match_proposal_reminder') THEN
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
WHEN (NEW.type IN ('match_proposal', 'match_proposal_reminder'))
EXECUTE FUNCTION public.notifications_dispatch_match_proposal();

REVOKE ALL ON FUNCTION public.notifications_dispatch_match_proposal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notifications_dispatch_match_proposal() FROM anon, authenticated;
