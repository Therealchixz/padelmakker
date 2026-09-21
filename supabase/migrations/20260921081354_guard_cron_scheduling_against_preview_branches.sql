-- Timeout-migrationen (20260921074448) var den FOERSTE der planlagde cron-jobs
-- i en migrationsfil. Baseline indeholder ingen cron.schedule - jobbene var lavet
-- i haanden i produktionen. Det havde en konsekvens jeg ikke forudsaa:
--
-- Supabase laver en preview-branch for hver pull request og koerer ALLE migrations
-- paa den. Preview-branches klones uden data (with_data: false), saa public.app_config
-- er tom dér. Jobbene blev derfor planlagt paa preview-branchen med en URL der peger
-- paa PRODUKTIONEN og en Authorization-header der er NULL.
--
-- Maalt: preview-branchen for PR #375 koerte migrations 07:49:59 og ramte produktionens
-- send-reminders kl. 08:00:02 med 401. Én gang - branchen blev slettet ved merge to
-- minutter senere. Men det ville have gentaget sig hvert 15. minut i hele PR'ens levetid,
-- og ved hver fremtidig PR.
--
-- Ingen skade sket: hemmeligheden manglede, saa produktionen afviste kaldet. Det er
-- praecis den kontrol der skal virke. Men et fremmed miljoe skal ikke banke paa doeren.
--
-- Rettelsen: planlaeg kun naar konfigurationen faktisk findes. Mangler den, ryd op og
-- SIG DET - en tavs afvisning er det vi har brugt hele forloebet paa at komme af med.

DO $guard$
DECLARE
  v_secret text;
  v_anon   text;
BEGIN
  SELECT value INTO v_secret FROM public.app_config WHERE key = 'reminder_cron_secret';
  SELECT value INTO v_anon   FROM public.app_config WHERE key = 'anon_key';

  IF coalesce(length(v_secret), 0) < 16 OR coalesce(length(v_anon), 0) < 32 THEN
    -- Her er vi ikke i produktionen. Fjern jobbene hvis en tidligere migration
    -- naaede at planlaegge dem, saa miljoeet ikke kalder produktionen.
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-reminders') THEN
      PERFORM cron.unschedule('send-reminders');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-reactivation-daily') THEN
      PERFORM cron.unschedule('send-reactivation-daily');
    END IF;

    RAISE WARNING 'cron: send-reminders og send-reactivation-daily blev IKKE planlagt - app_config mangler reminder_cron_secret/anon_key. Forventet paa preview-branches og friske databaser; i produktionen betyder det at app_config skal fyldes og denne migration koeres igen.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
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

  PERFORM cron.schedule(
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

  RAISE NOTICE 'cron: begge HTTP-job planlagt med 30 sekunders timeout';
END
$guard$;
