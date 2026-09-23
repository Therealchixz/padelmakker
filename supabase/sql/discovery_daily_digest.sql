-- Daglig opsummering af nye kampe og makkere (send-discovery-digest).
--
-- Der sendes højst én mail om dagen (claim_email_send_slot, nøgle
-- "discovery"). Før blev hver opdagelse mailet med det samme, så den ANDEN
-- opdagelse samme dag aldrig nåede de 96 af 98 brugere, der kun har mail.
-- Nu samles de i én mail kl. 17. Kampe i dag eller i morgen mailes stadig
-- med det samme af send-discovery-email.
--
-- 1. notifications.emailed_at husker, hvad der allerede er mailet, så samme
--    nyhed ikke kommer igen i næste opsummering.
-- 2. get_discovery_digest_candidates() finder pr. bruger de nyheder, der
--    stadig er relevante: ulæste, ikke mailet, højst 7 dage gamle, kampen er
--    stadig åben, ikke fuld, ikke overstået, og brugeren er ikke selv med.
-- 3. Cron kører kl. 15 og 16 UTC; funktionen sender kun, når klokken er 17 i
--    København, så tidspunktet holder både sommer- og vintertid.

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_discovery_digest_candidates()
RETURNS TABLE (user_id uuid, items jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $fn$
  SELECT
    n.user_id,
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'type', n.type,
        'title', n.title,
        'body', n.body,
        'match_id', n.match_id,
        'entity_id', n.entity_id,
        'created_at', n.created_at
      )
      ORDER BY n.type, n.created_at DESC
    ) AS items
  FROM public.notifications n
  JOIN public.profiles p ON p.id = n.user_id
  LEFT JOIN public.matches m ON m.id = n.match_id
  LEFT JOIN public.profiles s ON s.id = n.entity_id
  WHERE n.type IN ('match_watch_match', 'makker_suggestion')
    AND n.read = false
    AND n.emailed_at IS NULL
    AND n.created_at >= now() - interval '7 days'
    AND COALESCE(p.is_banned, false) = false
    -- Samme regel som send-discovery-email: kun ved et udtrykkeligt ja, som
    -- standarden og backfillen i 20260922224224 sætter, og som et klik på
    -- "Afmeld" fjerner.
    AND COALESCE(p.notification_prefs -> 'email' ->> 'opdagelse', '') = 'true'
    AND (
      (
        n.type = 'match_watch_match'
        AND m.id IS NOT NULL
        AND COALESCE(m.status, 'open') = 'open'
        AND COALESCE(m.current_players, 0) < COALESCE(m.max_players, 4)
        AND ((m.date + COALESCE(public.parse_clock_time(m.time), time '23:59'))
              AT TIME ZONE 'Europe/Copenhagen') > now()
        AND NOT EXISTS (
          SELECT 1 FROM public.match_players mp
          WHERE mp.match_id = m.id AND mp.user_id = n.user_id
        )
      )
      OR (
        n.type = 'makker_suggestion'
        AND s.id IS NOT NULL
        AND COALESCE(s.is_banned, false) = false
      )
    )
  GROUP BY n.user_id;
$fn$;

ALTER FUNCTION public.get_discovery_digest_candidates() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_discovery_digest_candidates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_discovery_digest_candidates() FROM anon;
REVOKE ALL ON FUNCTION public.get_discovery_digest_candidates() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_digest_candidates() TO service_role;

-- Jobbet læser hemmeligheden fra app_config. Tabellen skal forblive lukket
-- for almindelige brugere (se 20260921081510); gentaget her, så reglen står i
-- den seneste migration, der rører app_config.
REVOKE ALL ON public.app_config FROM anon;
REVOKE ALL ON public.app_config FROM authenticated;

-- Planlæg kun, når konfigurationen findes (se 20260921081354): på en
-- preview-branch uden data ville jobbet ellers kalde produktionen.
DO $guard$
DECLARE
  v_secret text;
  v_anon   text;
BEGIN
  SELECT value INTO v_secret FROM public.app_config WHERE key = 'reminder_cron_secret';
  SELECT value INTO v_anon   FROM public.app_config WHERE key = 'anon_key';
  IF coalesce(length(v_secret), 0) < 16 OR coalesce(length(v_anon), 0) < 32 THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-discovery-digest') THEN
      PERFORM cron.unschedule('send-discovery-digest');
    END IF;
    RAISE WARNING 'cron: send-discovery-digest blev IKKE planlagt - app_config mangler reminder_cron_secret/anon_key. Forventet paa preview-branches og friske databaser; i produktionen betyder det at app_config skal fyldes og denne migration koeres igen.';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'send-discovery-digest',
    '0 15,16 * * *',
    $job$
      select net.http_post(
        url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-discovery-digest',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (select value from public.app_config where key='anon_key'),
          'apikey', (select value from public.app_config where key='anon_key'),
          'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$
  );
  RAISE NOTICE 'cron: send-discovery-digest planlagt (kl. 15 og 16 UTC, sender kl. 17 dansk tid)';
END
$guard$;
