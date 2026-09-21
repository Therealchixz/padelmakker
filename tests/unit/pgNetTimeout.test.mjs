/**
 * pg_net's standard-timeout er 5 sekunder, og den er tavs: rammer man den, staar
 * der ingenting i cron-historikken - kun en raekke i net._http_response med
 * status_code = NULL, som ingen kigger paa.
 *
 * Maalt i produktionen 21. sep. 2026: 7 af 24 cron-kald paa seks timer fik intet
 * svar. Alle var 5-sekunders timeouts. send-reminders bruger 3 sekunder paa en
 * god koersel og 5-10 sekunder kl. :00 og :30, saa graensen laa allerede taet paa.
 *
 * Testen her sikrer, at nye migrations ikke genindfoerer standarden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';

/** Alle migrations undtagen baseline, nyeste sidst. */
function migrationsEfterBaseline() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== BASELINE)
    .sort();
}

test('nye migrations saetter timeout paa hvert net.http_post', () => {
  // Baseline er undtaget med vilje: den er et dump af produktionen som den saa
  // ud FOER rettelsen, og maa ikke skrives om.
  for (const fil of migrationsEfterBaseline()) {
    const sql = readFileSync(join(migrationsDir, fil), 'utf8');
    const kald = (sql.match(/net\.http_post\s*\(/g) || []).length;
    if (kald === 0) continue;
    const timeouts = (sql.match(/timeout_milliseconds\s*:=/g) || []).length;
    assert.equal(
      timeouts,
      kald,
      `${fil}: ${kald} net.http_post-kald men ${timeouts} timeout_milliseconds. `
        + 'Uden den falder kaldet paa 5 sekunder, og det sker i tavshed.',
    );
  }
});

test('den gaeldende dispatch_push_to_user har en timeout', () => {
  // Den sidste migration der definerer funktionen, er den der koerer.
  const definerende = migrationsEfterBaseline()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => /FUNCTION\s+public\.dispatch_push_to_user/i.test(sql));

  assert.ok(
    definerende.length > 0,
    'ingen migration oven paa baseline definerer dispatch_push_to_user - '
      + 'saa koerer baselines udgave, som ikke saetter timeout',
  );
  const nyeste = definerende[definerende.length - 1];
  assert.match(
    nyeste.sql,
    /timeout_milliseconds\s*:=\s*\d+/,
    `${nyeste.f} definerer dispatch_push_to_user uden timeout`,
  );
});

test('begge HTTP-cronjob planlaegges med timeout', () => {
  const alle = migrationsEfterBaseline()
    .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
    .join('\n');

  for (const job of ['send-reminders', 'send-reactivation-daily']) {
    const i = alle.indexOf(`'${job}'`);
    assert.notEqual(i, -1, `ingen migration planlaegger ${job}`);
    // Timeouten skal staa i selve jobbets krop, ikke bare et sted i filen.
    const krop = alle.slice(i, i + 1200);
    assert.match(
      krop,
      /timeout_milliseconds\s*:=\s*\d+/,
      `${job} planlaegges uden timeout_milliseconds`,
    );
  }
});
