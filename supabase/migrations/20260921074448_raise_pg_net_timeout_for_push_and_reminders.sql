-- pg_net's standard-timeout er 5 sekunder. Ingen af de tre steder der kalder
-- net.http_post satte den, og send-reminders bruger 3 sekunder paa en GOD
-- koersel og 5-10 sekunder kl. :00 og :30. Maalt over seks timer gav 7 af 24
-- cron-kald intet svar overhovedet - alle 5-sekunders timeouts, alle paa hele
-- og halve timer.
--
-- Det var ikke databasen: auto_confirm_expired_match_results bruger 21 ms i
-- gennemsnit (max 206), get_due_reminders 34 ms (max 368). Det er edge-
-- funktionens egen koeretid, og den ligger allerede farligt taet paa graensen
-- selv naar alt gaar godt.
--
-- 30 sekunder giver plads. net.http_post er asynkron - timeouten gaelder
-- pg_nets baggrundsarbejder, ikke den der kalder - saa en hoejere graense
-- blokerer ingenting.

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || (select value from public.app_config where key='anon_key'),
        'apikey', (select value from public.app_config where key='anon_key'),
        'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

select cron.schedule(
  'send-reactivation-daily',
  '0 7 * * *',
  $job$
    select net.http_post(
      url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-reactivation',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || (select value from public.app_config where key='anon_key'),
        'apikey', (select value from public.app_config where key='anon_key'),
        'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- Samme hul i push-udsendelsen for match_proposal: den eneste push-vej der
-- koeres af databasen selv.
CREATE OR REPLACE FUNCTION public.dispatch_push_to_user(
  p_user_id uuid,
  p_title text,
  p_body text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
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
    RAISE WARNING 'dispatch_push_to_user: app_config.reminder_cron_secret mangler - push blev ikke sendt';
    RETURN NULL;
  END IF;

  SELECT value INTO v_anon_key
  FROM public.app_config
  WHERE key = 'anon_key';

  IF v_anon_key IS NULL OR length(v_anon_key) < 32 THEN
    RAISE WARNING 'dispatch_push_to_user: app_config.anon_key mangler - push blev ikke sendt';
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
    )),
    timeout_milliseconds := 30000
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$fn$;
