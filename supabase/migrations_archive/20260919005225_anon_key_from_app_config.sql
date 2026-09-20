-- Fjern den indlejrede anon-nøgle fra push- og påmindelses-rørene.
--
-- Nøglen er offentlig, så det er ikke en lækage. Problemet er rotation: skiftes
-- nøglen, holder push og påmindelser op med at virke, og det sker lydløst —
-- ingen fejl i appen, beskederne udebliver bare.
--
-- app_config havde i forvejen en anon_key-række med præcis samme værdi; den
-- blev bare aldrig brugt. Efter denne ændring læses nøglen derfra tre steder,
-- så rotation er én opdatering af én række.
--
-- Tre steder havde den indlejret:
--   - funktionen dispatch_push_to_user
--   - cron-jobbet send-reminders (hvert 15. minut)
--   - cron-jobbet send-reactivation-daily
--
-- dispatch_push_to_user kaldes fra en trigger på notifications. Den må derfor
-- ikke kaste en exception ved manglende konfiguration — det ville blokere selve
-- notifikationen. Den logger i stedet en advarsel, så en manglende nøgle kan
-- ses i loggen i stedet for at forsvinde i stilhed.

CREATE OR REPLACE FUNCTION public.dispatch_push_to_user(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_entity_type text DEFAULT NULL::text,
  p_entity_id uuid DEFAULT NULL::uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_secret text;
  v_anon_key text;
  v_req_id bigint;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_title), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT value INTO v_secret
  FROM public.app_config
  WHERE key = 'reminder_cron_secret';

  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE WARNING 'dispatch_push_to_user: app_config.reminder_cron_secret mangler — push blev ikke sendt';
    RETURN NULL;
  END IF;

  SELECT value INTO v_anon_key
  FROM public.app_config
  WHERE key = 'anon_key';

  IF v_anon_key IS NULL OR length(v_anon_key) < 32 THEN
    RAISE WARNING 'dispatch_push_to_user: app_config.anon_key mangler — push blev ikke sendt';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/dispatch-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key,
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

-- Cron-jobbene læste allerede reminder_cron_secret fra app_config; nu hentes
-- nøglen samme sted.
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'send-reminders'),
  command := $cron$
    select net.http_post(
      url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || (select value from public.app_config where key='anon_key'),
        'apikey', (select value from public.app_config where key='anon_key'),
        'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $cron$
);

SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'send-reactivation-daily'),
  command := $cron$
    select net.http_post(
      url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-reactivation',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || (select value from public.app_config where key='anon_key'),
        'apikey', (select value from public.app_config where key='anon_key'),
        'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
