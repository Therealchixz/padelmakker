/**
 * Push-afsendelsen laa foer som et "fire and forget" med `.catch(() => {})`.
 * To fejl fulgte af det, og begge blev maalt i produktionen 21. sep. 2026:
 *
 *   1. Fejlede kaldet, forsvandt fejlen sporloest, og testknappen sagde
 *      "Test sendt - tjek lock screen nu" alligevel.
 *   2. Uden `keepalive` afbryder browseren kaldet, naar siden suspenderes.
 *      CORS-preflighten naaede frem kl. 09:23:14; selve kaldet aldrig, fordi
 *      skaermen blev laast i sekundet efter.
 *
 * Testene herunder koerer den rigtige kode med en falsk fetch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deliverPush, pushResult } from '../../src/lib/pushDelivery.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Fanger det kald deliverPush laver, saa vi kan se paa optionsene bagefter. */
function fangetFetch(svar) {
  const kald = [];
  const fn = async (url, opts) => {
    kald.push({ url, opts });
    if (typeof svar === 'function') return svar();
    return svar;
  };
  fn.kald = kald;
  return fn;
}

const OK = { ok: true, status: 200, text: async () => '{"sent":1}' };

test('et vellykket kald giver ok', async () => {
  const f = fangetFetch(OK);
  const r = await deliverPush({ fetchImpl: f, url: 'https://x/send-push', accessToken: 't', payload: {} });
  assert.deepEqual(r, { ok: true, reason: 'sent' });
  assert.equal(f.kald.length, 1);
});

test('en netvaerksfejl bliver rapporteret, ikke slugt', async () => {
  // Det er hele pointen: foer returnerede koden undefined og lod som ingenting.
  const f = fangetFetch(() => { throw new TypeError('Failed to fetch'); });
  const r = await deliverPush({ fetchImpl: f, url: 'https://x/send-push', accessToken: 't', payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'network_error');
  assert.match(r.detail, /Failed to fetch/);
});

test('en CORS-blokering ligner en netvaerksfejl og skal ogsaa fanges', async () => {
  // Browseren giver ingen detaljer ved CORS - kun en tom TypeError.
  const f = fangetFetch(() => { throw new TypeError(''); });
  const r = await deliverPush({ fetchImpl: f, url: 'https://x/send-push', accessToken: 't', payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'network_error');
});

test('en HTTP-fejl giver status og krop med', async () => {
  const f = fangetFetch({ ok: false, status: 403, text: async () => 'Origin not allowed' });
  const r = await deliverPush({ fetchImpl: f, url: 'https://x/send-push', accessToken: 't', payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'http_error');
  assert.equal(r.detail, '403: Origin not allowed');
});

test('en HTTP-fejl uden laesbar krop giver stadig et resultat', async () => {
  const f = fangetFetch({ ok: false, status: 500, text: async () => { throw new Error('ingen krop'); } });
  const r = await deliverPush({ fetchImpl: f, url: 'https://x/send-push', accessToken: 't', payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'http_error');
  assert.equal(r.detail, '500');
});

test('kaldet saettes med keepalive, saa det overlever at siden lukkes', async () => {
  const f = fangetFetch(OK);
  await deliverPush({ fetchImpl: f, url: 'https://x/send-push', accessToken: 't', payload: { a: 1 } });
  assert.equal(f.kald[0].opts.keepalive, true, 'uden keepalive doer kaldet naar skaermen laases');
  assert.equal(f.kald[0].opts.method, 'POST');
  assert.equal(f.kald[0].opts.headers.Authorization, 'Bearer t');
  assert.equal(f.kald[0].opts.body, '{"a":1}');
});

test('deliverPush kaster aldrig - ogsaa uden fetch overhovedet', async () => {
  const r = await deliverPush({ fetchImpl: null, url: 'https://x', accessToken: 't', payload: {} });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'network_error');
});

test('pushResult udelader detail naar der ikke er nogen', () => {
  assert.deepEqual(pushResult(false, 'no_session'), { ok: false, reason: 'no_session' });
  assert.deepEqual(pushResult(true, 'sent', 'x'), { ok: true, reason: 'sent', detail: 'x' });
});

// --- Kaldstedet ------------------------------------------------------------
// deliverPush kan koeres direkte. notifications.js og knappen kan ikke - de
// haenger paa Supabase-klienten og import.meta.env - saa dér kontrolleres
// strukturen i stedet. Det er svagere, men det fanger den fejl der faktisk skete:
// at fejlen blev slugt, og at knappen meldte succes uanset hvad.

test('notifications.js sluger ikke laengere push-fejl', () => {
  const src = readFileSync(join(root, 'src/lib/notifications.js'), 'utf8');
  assert.doesNotMatch(
    src,
    /\.catch\(\(\)\s*=>\s*\{\s*\/\*\s*ignor[eé]r netv[aæ]rksfejl\s*\*\/\s*\}\)/,
    'den tomme catch er tilbage - saa forsvinder push-fejl sporloest igen',
  );
  assert.match(src, /deliverPush\(/, 'push skal sendes gennem den testbare deliverPush');
  assert.match(src, /onPushResult/, 'udfaldet skal kunne gives videre til kaldestedet');
});

test('testknappen melder kun succes naar push'
  + ' faktisk gik af sted', () => {
  const src = readFileSync(join(root, 'src/components/NotificationPushControls.jsx'), 'utf8');
  assert.match(src, /onPushResult/, 'knappen skal spoerge om udfaldet');
  assert.match(
    src,
    /pushOutcome\s*&&\s*!pushOutcome\.ok/,
    'knappen skal tjekke udfaldet, foer den siger "tjek lock screen"',
  );
});
