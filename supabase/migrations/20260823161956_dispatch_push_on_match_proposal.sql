-- Phone push when a 4-person play-intent proposal is created.
-- SQL writes the in-app row; this trigger rings the lock screen via dispatch-push.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_push_to_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_secret text;
  v_req_id bigint;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_title), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT value INTO v_secret
  FROM public.app_config
  WHERE key = 'reminder_cron_secret';

  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/dispatch-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bXJzcXJlcmtvZnRjcHBma2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzEwNTIsImV4cCI6MjA5MDc0NzA1Mn0.ApMY3hPJ5SdlXWgUeZ5odDWt5Z0PYnQqihSJbQ6gqgM',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bXJzcXJlcmtvZnRjcHBma2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzEwNTIsImV4cCI6MjA5MDc0NzA1Mn0.ApMY3hPJ5SdlXWgUeZ5odDWt5Z0PYnQqihSJbQ6gqgM',
      'x-cron-secret', v_secret
    ),
    body := jsonb_strip_nulls(jsonb_build_object(
      'targetUserId', p_user_id,
      'title', p_title,
      'body', COALESCE(p_body, ''),
      'type', COALESCE(NULLIF(btrim(p_type), ''), 'makker_suggestion'),
      'entityType', p_entity_type,
      'entityId', p_entity_id
    ))
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_push_to_user(uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_push_to_user(uuid, text, text, text, text, uuid) FROM anon, authenticated;

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
