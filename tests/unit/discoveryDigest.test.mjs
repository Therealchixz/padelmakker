/**
 * Daglig opsummering kl. 17 + "stille om natten".
 *
 * Maalt 23. sep. 2026: 96 af 98 brugere kan kun naas paa mail, og der sendes
 * hoejst én mail om dagen. Blev hver nyhed mailet med det samme, gik den ANDEN
 * nyhed samme dag tabt. Nu samles de i én mail kl. 17; kun kampe i dag eller i
 * morgen sendes med det samme.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDigestEmail, copenhagenHour, digestSubject, MAX_ITEMS_PER_SECTION } from '../../supabase/functions/send-discovery-digest/content.ts';
import {
  normalizeNotificationPrefs,
  mergeQuietHours,
  mergeNotificationPushLevel,
  mergeNotificationEmailToggle,
  isWithinQuietHours,
} from '../../src/lib/notificationPreferences.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const digestFn = read('supabase/functions/send-discovery-digest/index.ts');
const discoveryFn = read('supabase/functions/send-discovery-email/index.ts');
const pushFn = read('supabase/functions/send-push/index.ts');
const migration = (() => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_discovery_daily_digest.sql')).pop();
  return f ? readFileSync(join(dir, f), 'utf8') : '';
})();

const opts = { siteUrl: 'https://www.padelmakker.dk', unsubLink: 'https://x/unsub?t=abc', cvr: '46403193' };
const match = (n, id = `m${n}`) => ({ id: `n-${id}`, type: 'match_watch_match', title: 'Ny kamp', body: `Åben kamp ${n}`, match_id: id, entity_id: null, created_at: '2026-09-23T10:00:00Z' });
const makker = (n, id = `p${n}`) => ({ id: `n-${id}`, type: 'makker_suggestion', title: 'Ny makker', body: `Spiller ${n} søger makker`, match_id: null, entity_id: id, created_at: '2026-09-23T10:00:00Z' });

// --- Mailens indhold ----------------------------------------------------

test('emnet siger hvad der er i mailen', () => {
  assert.equal(digestSubject(2, 1), 'I dag på PadelMakker: 2 nye kampe og 1 makker, der passer til dig');
  assert.equal(digestSubject(1, 0), 'I dag på PadelMakker: 1 ny kamp, der passer til dig');
  assert.equal(digestSubject(0, 3), 'I dag på PadelMakker: 3 makkere, der passer til dig');
});

test('kampe og makkere samles i én mail med links', () => {
  const mail = buildDigestEmail([match(1), match(2), makker(1)], opts);
  assert.ok(mail);
  assert.match(mail.text, /Nye kampe nær dig/);
  assert.match(mail.text, /Spiller der søger makker/);
  assert.match(mail.text, /\/dashboard\/kampe\/2v2\/m1/);
  assert.match(mail.text, /\/dashboard\/makkere\?profile=p1/);
  assert.deepEqual(mail.itemIds, ['n-m1', 'n-m2', 'n-p1']);
});

test('samme kamp eller spiller vises kun én gang', () => {
  const mail = buildDigestEmail([match(1, 'x'), match(2, 'x'), makker(1, 'y'), makker(2, 'y')], opts);
  assert.equal(mail.subject, 'I dag på PadelMakker: 1 ny kamp og 1 makker, der passer til dig');
  // Begge rækker markeres som mailet, så dubletten ikke kommer i morgen.
  assert.equal(mail.itemIds.length, 4);
});

test('lange lister afsluttes med "og N mere"', () => {
  const many = Array.from({ length: MAX_ITEMS_PER_SECTION + 3 }, (_, i) => match(i));
  const mail = buildDigestEmail(many, opts);
  assert.match(mail.text, /og 3 mere/);
  assert.match(mail.html, /og 3 mere/);
});

test('ingen nyheder, ingen mail', () => {
  assert.equal(buildDigestEmail([], opts), null);
  assert.equal(buildDigestEmail([{ id: 'z', type: 'match_chat', body: 'x' }], opts), null);
});

test('tekst fra brugere escapes i html', () => {
  const mail = buildDigestEmail([{ ...makker(1), body: '<script>alert(1)</script> søger makker' }], opts);
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;/);
});

test('mailen kan afmeldes med ét klik og oplyser afsenderen', () => {
  const mail = buildDigestEmail([match(1)], opts);
  for (const body of [mail.text, mail.html]) {
    assert.match(body, /unsub\?t=abc/);
    assert.match(body, /CVR 46403193/);
    assert.match(body, /privatlivspolitik/);
  }
  assert.doesNotMatch(mail.text + mail.html, /har slået e-mail til/);
  assert.match(digestFn, /"List-Unsubscribe": `<\$\{unsubLink\}>`/);
  assert.match(digestFn, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/);
  assert.match(digestFn, /const CVR = "46403193"/);
});

// --- Tidspunkt og spærrer -----------------------------------------------

test('kl. 17 dansk tid både sommer og vinter', () => {
  assert.equal(copenhagenHour(new Date('2026-07-01T15:00:00Z')), 17);
  assert.equal(copenhagenHour(new Date('2026-01-15T16:00:00Z')), 17);
  assert.match(migration, /'0 15,16 \* \* \*'/, 'cron skal køre kl. 15 og 16 UTC');
  assert.match(digestFn, /hour !== DIGEST_LOCAL_HOUR/);
});

test('opsummeringen deler den daglige spærre med alle andre mails', () => {
  const m = /claim_email_send_slot[\s\S]{0,160}?p_kind:\s*"([a-z_]+)"/.exec(digestFn);
  assert.ok(m);
  assert.equal(m[1], 'discovery');
  assert.match(digestFn, /release_email_send_slot/, 'en fejlet mail må ikke koste dagens plads');
  assert.match(digestFn, /x-cron-secret/, 'kun det planlagte job må starte masseudsendelse');
});

test('det mailede markeres, så det ikke kommer igen', () => {
  assert.match(digestFn, /update\(\{ emailed_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(discoveryFn, /update\(\{ emailed_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS emailed_at timestamptz/);
  assert.match(migration, /n\.emailed_at IS NULL/);
});

test('kun kampe i dag eller i morgen mailes med det samme', () => {
  assert.match(discoveryFn, /function sendsImmediately\(type: string, matchDate: string \| null\)/);
  assert.match(discoveryFn, /type !== "match_watch_match"/);
  assert.match(discoveryFn, /copenhagenDate\(0\) \|\| d === copenhagenDate\(1\)/);
  assert.match(discoveryFn, /skipped: "digest"/);
});

test('databasefunktionen er kun for serveren, og cron er bag kontrollen', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_discovery_digest_candidates\(\) FROM anon/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_discovery_digest_candidates\(\) FROM authenticated/);
  assert.match(migration, /app_config/);
  assert.match(migration, /cron\.unschedule\('send-discovery-digest'\)/);
  assert.match(migration, /RAISE WARNING/);
  assert.match(migration, /notification_prefs -> 'email' ->> 'opdagelse'/, 'kun dem der vil have mail');
});

// --- Stille om natten -----------------------------------------------------

test('stille om natten er slået til som standard, kl. 22-07', () => {
  assert.deepEqual(normalizeNotificationPrefs(null).quietHours, { enabled: true, start: 22, end: 7 });
  assert.deepEqual(normalizeNotificationPrefs({ quietHours: { enabled: false } }).quietHours, { enabled: false, start: 22, end: 7 });
  assert.deepEqual(normalizeNotificationPrefs({ quietHours: { start: 99, end: -1 } }).quietHours, { enabled: true, start: 22, end: 7 });
});

test('tidsrummet må gå over midnat', () => {
  assert.equal(isWithinQuietHours(23, 22, 7), true);
  assert.equal(isWithinQuietHours(3, 22, 7), true);
  assert.equal(isWithinQuietHours(7, 22, 7), false);
  assert.equal(isWithinQuietHours(12, 22, 7), false);
  assert.equal(isWithinQuietHours(13, 12, 14), true);
  assert.equal(isWithinQuietHours(10, 10, 10), false);
});

test('andre indstillinger mister ikke valget', () => {
  const p = mergeQuietHours(null, { enabled: true, start: 23, end: 6 });
  assert.deepEqual(mergeNotificationPushLevel(p, 'important').quietHours, { enabled: true, start: 23, end: 6 });
  assert.deepEqual(mergeNotificationEmailToggle(p, 'opdagelse', false).quietHours, { enabled: true, start: 23, end: 6 });
});

test('send-push holder tæt om natten, undtagen for det vigtige', () => {
  assert.match(pushFn, /const QUIET_DEFAULT = \{ enabled: true, start: 22, end: 7 \}/);
  assert.match(pushFn, /policy\.level !== "critical" &&\s*quiet\.enabled &&\s*isWithinQuietHours\(copenhagenHour\(\), quiet\.start, quiet\.end\)/);
  assert.match(pushFn, /skipped: "quiet_hours"/);
});

test('indstillingen kan findes både på telefon og computer', () => {
  const panel = read('src/components/NotificationSettingsPanel.jsx');
  assert.match(panel, /Stille om natten/);
  assert.match(panel, /mergeQuietHours\(notifPrefs, \{ enabled: e\.target\.checked \}\)/);
  assert.match(panel, /samles i én mail kl\. 17/);
  // Klokken åbner en side på telefonen; indstillingerne skal også være dér.
  assert.match(read('src/components/NotificationBell.jsx'), /<NotificationSettingsPanel \/>/);
  assert.match(read('src/pages/NotifikationerPage.jsx'), /<NotificationSettingsPanel \/>/);
});
