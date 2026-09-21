/**
 * Supabase laver en preview-branch for hver pull request og koerer ALLE migrations
 * paa den. Branchen klones UDEN data, saa public.app_config er tom dér.
 *
 * Timeout-migrationen (20260921074448) planlagde cron-jobbene ubetinget. Paa
 * preview-branchen blev de derfor planlagt med en URL der peger paa PRODUKTIONEN
 * og en Authorization-header der er NULL. Maalt 21. sep. 2026: preview-branchen for
 * PR #375 koerte migrations 07:49:59 og ramte produktionens send-reminders 08:00:02
 * med 401. Branchen blev slettet ved merge to minutter senere, saa det skete én gang
 * - men det ville have gentaget sig hvert 15. minut i hele PR'ens levetid.
 *
 * Testen her sikrer at enhver migration der planlaegger et HTTP-cronjob, foerst
 * kontrollerer at konfigurationen findes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';

function migrationsEfterBaseline() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== BASELINE)
    .sort();
}

/** Den SIDSTE migration der roerer et jobnavn, er den der gaelder. */
function sidsteMigrationDerPlanlaegger(job) {
  const traef = migrationsEfterBaseline()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => sql.includes(`'${job}'`));
  return traef.length ? traef[traef.length - 1] : null;
}

for (const job of ['send-reminders', 'send-reactivation-daily']) {
  test(`${job} planlaegges bag en kontrol af app_config`, () => {
    const nyeste = sidsteMigrationDerPlanlaegger(job);
    assert.ok(nyeste, `ingen migration planlaegger ${job}`);

    assert.match(
      nyeste.sql,
      /app_config/,
      `${nyeste.f} planlaegger ${job} uden at slaa app_config op foerst - `
        + 'paa en preview-branch uden data giver det et kald mod produktionen',
    );
    assert.match(
      nyeste.sql,
      /cron\.unschedule/,
      `${nyeste.f} rydder ikke op: mangler konfigurationen, skal jobbet fjernes, `
        + 'ikke blot springes over - en tidligere migration kan have planlagt det',
    );
    assert.match(
      nyeste.sql,
      /RAISE WARNING/,
      `${nyeste.f} springer over i tavshed - sig hvorfor jobbet ikke blev planlagt`,
    );
  });
}

test('produktions-URL staar kun i migrations der har kontrollen', () => {
  const PROD = 'hzmrsqrerkoftcppfklu.supabase.co/functions';
  for (const fil of migrationsEfterBaseline()) {
    const sql = readFileSync(join(migrationsDir, fil), 'utf8');
    if (!sql.includes(PROD)) continue;
    if (!/cron\.schedule/.test(sql)) continue; // dispatch_push_to_user kaldes kun af produktionen selv
    assert.match(
      sql,
      /app_config/,
      `${fil} planlaegger cron mod produktions-URL'en uden en kontrol af app_config`,
    );
  }
});

/**
 * app_config rummer reminder_cron_secret og anon_key. RLS er slaaet til uden
 * politikker, saa tabellen ikke kan laeses gennem API'et - men RLS gaelder ikke
 * TRUNCATE, og anon/authenticated havde den rettighed. Migrationen 20260921081510
 * fjerner grants'ene. Testen her sikrer at den ikke forsvinder igen.
 */
test('app_config har ingen aabne grants i migrationshistorikken', () => {
  const filer = migrationsEfterBaseline()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => /\bapp_config\b/.test(sql) && /\b(GRANT|REVOKE)\b/i.test(sql));

  assert.ok(
    filer.length > 0,
    'ingen migration styrer rettighederne paa app_config - hemmelighederne '
      + 'ligger saa med Supabases standard-grants til anon og authenticated',
  );

  // Den sidste der roerer rettighederne, er den der gaelder.
  const sidste = filer[filer.length - 1];
  assert.match(
    sidste.sql,
    /REVOKE\s+ALL\s+ON\s+public\.app_config\s+FROM\s+anon/i,
    `${sidste.f}: anon skal ikke have rettigheder paa app_config`,
  );
  assert.match(
    sidste.sql,
    /REVOKE\s+ALL\s+ON\s+public\.app_config\s+FROM\s+authenticated/i,
    `${sidste.f}: authenticated skal ikke have rettigheder paa app_config`,
  );
});
