/**
 * Får mailene folk tilbage? + engangsmailen til inaktive.
 *
 * Maalt 24. sep. 2026: 79 af 99 brugere har ikke vaeret inde i 30 dage. Vi
 * sendte mails, men kunne ikke se, om nogen trykkede. Nu har hvert link et
 * maerke (?kilde=...), som appen gemmer efter login (log_app_return).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildDigestEmail,
  buildWinbackEmail,
  withKilde,
  WINBACK_NEWS,
} from '../../supabase/functions/send-discovery-digest/content.ts';
import {
  captureVisitSource,
  readPendingVisitSource,
  normalizeVisitSource,
  VISIT_SOURCE_STORAGE_KEY,
  VISIT_SOURCE_MAX_AGE_MS,
} from '../../src/lib/visitSource.js';
import { mailReturnRows, mailSentSummary } from '../../src/lib/mailReturnStats.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const migration = (suffix) => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith(suffix)).pop();
  assert.ok(f, `mangler migration *${suffix}`);
  return readFileSync(join(dir, f), 'utf8');
};

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const OPTS = { siteUrl: 'https://www.padelmakker.dk', unsubLink: 'https://x.supabase.co/functions/v1/email-unsubscribe?t=abc', cvr: '46403193' };

// --- Maerket paa links ------------------------------------------------------

test('withKilde tilføjer mærket rigtigt, også med ? og #', () => {
  assert.equal(withKilde('https://a.dk/x', 'digest'), 'https://a.dk/x?kilde=digest');
  assert.equal(withKilde('https://a.dk/x?p=1', 'digest'), 'https://a.dk/x?p=1&kilde=digest');
  assert.equal(withKilde('https://a.dk/x#top', 'winback'), 'https://a.dk/x?kilde=winback#top');
  assert.equal(withKilde('https://a.dk/x', ''), 'https://a.dk/x');
  assert.equal(withKilde('https://a.dk/x', 'ond kilde!'), 'https://a.dk/x');
});

test('den daglige mail mærker alle app-links, men ikke framelding og privatliv', () => {
  const email = buildDigestEmail(
    [
      { id: 'n1', type: 'match_watch_match', title: 't', body: 'b', match_id: 'm1', entity_id: null, created_at: '' },
      { id: 'n2', type: 'makker_suggestion', title: 't', body: 'b', match_id: null, entity_id: 'p1', created_at: '' },
    ],
    OPTS,
    { recipientName: 'Kevin', todayLabel: 'Torsdag 24. september' },
  );
  const hrefs = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const appLinks = hrefs.filter((h) => h.includes('/dashboard'));
  assert.ok(appLinks.length >= 4);
  for (const h of appLinks) assert.match(h, /[?&]kilde=digest(#|$)/, h);
  assert.ok(hrefs.some((h) => h === OPTS.unsubLink), 'frameldingslinket er uændret');
  assert.ok(hrefs.some((h) => h.endsWith('/privatlivspolitik')), 'privatlivslinket er uændret');
  assert.match(email.text, /kilde=digest/);
});

test('hurtig-mailen og påmindelsen mærker også deres links', () => {
  assert.match(read('supabase/functions/send-discovery-email/index.ts'), /\?kilde=opdagelse/);
  assert.match(read('supabase/functions/send-reactivation/index.ts'), /\?kilde=paamindelse/);
});

// --- Appen husker maerket -----------------------------------------------------

test('appen gemmer mærket og fjerner det fra adressen', () => {
  const storage = memoryStorage();
  let replaced = null;
  const history = { state: null, replaceState: (_s, _t, url) => { replaced = url; } };
  const k = captureVisitSource({ pathname: '/dashboard/kampe', search: '?kilde=Digest&x=1', hash: '#a' }, storage, history);
  assert.equal(k, 'digest');
  assert.equal(replaced, '/dashboard/kampe?x=1#a');
  assert.deepEqual(readPendingVisitSource(storage), { kilde: 'digest', path: '/dashboard/kampe' });
});

test('uden mærke rører appen hverken adresse eller lager', () => {
  const storage = memoryStorage();
  let called = false;
  const history = { replaceState: () => { called = true; } };
  assert.equal(captureVisitSource({ pathname: '/', search: '?x=1', hash: '' }, storage, history), null);
  assert.equal(called, false);
  assert.equal(storage.getItem(VISIT_SOURCE_STORAGE_KEY), null);
});

test('ugyldigt mærke fjernes fra adressen, men gemmes ikke', () => {
  const storage = memoryStorage();
  let replaced = null;
  const history = { replaceState: (_s, _t, url) => { replaced = url; } };
  assert.equal(captureVisitSource({ pathname: '/a', search: '?kilde=%3Cscript%3E', hash: '' }, storage, history), null);
  assert.equal(replaced, '/a');
  assert.equal(readPendingVisitSource(storage), null);
  assert.equal(normalizeVisitSource('x'.repeat(33)), null);
});

test('et gammelt mærke (over to timer) tæller ikke', () => {
  const storage = memoryStorage();
  const at = Date.now() - VISIT_SOURCE_MAX_AGE_MS - 1000;
  storage.setItem(VISIT_SOURCE_STORAGE_KEY, JSON.stringify({ kilde: 'digest', path: '/', at }));
  assert.equal(readPendingVisitSource(storage), null);
  assert.equal(storage.getItem(VISIT_SOURCE_STORAGE_KEY), null);
});

test('lager der kaster fejl (privat vindue) vælter ikke appen', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(captureVisitSource({ pathname: '/', search: '?kilde=digest', hash: '' }, broken, null), 'digest');
  assert.equal(readPendingVisitSource(broken), null);
});

test('appen sender mærket efter login og ved opstart', () => {
  const auth = read('src/lib/AuthContext.jsx');
  assert.equal(auth.split('logPendingVisitSource()').length - 1, 2);
  assert.match(read('src/main.jsx'), /captureVisitSource\(window\.location, window\.sessionStorage, window\.history\)/);
});

// --- Databasen ----------------------------------------------------------------

test('log_app_return: kun logget ind, browseren kan ikke læse tabellen', () => {
  const m = migration('_app_return_tracking.sql');
  assert.match(m, /ALTER TABLE public\.app_returns ENABLE ROW LEVEL SECURITY/);
  assert.match(m, /REVOKE ALL ON TABLE public\.app_returns FROM PUBLIC, anon, authenticated/);
  assert.match(m, /REVOKE ALL ON FUNCTION public\.log_app_return\(text, text\) FROM PUBLIC, anon;/);
  assert.match(m, /v_uid uuid := auth\.uid\(\)/);
  assert.match(m, /interval '30 minutes'/);
  assert.match(m, /ON DELETE CASCADE/, 'slettes med kontoen');
  assert.match(m, /admin_mail_return_stats[\s\S]*public\.is_admin\(\)/);
});

test('get_winback_candidates kan kun kaldes af serveren', () => {
  const m = migration('_winback_candidates.sql');
  assert.match(m, /REVOKE ALL ON FUNCTION public\.get_winback_candidates\(integer\) FROM PUBLIC, anon, authenticated;/);
  assert.match(m, /GRANT EXECUTE ON FUNCTION public\.get_winback_candidates\(integer\) TO service_role;/);
  // Samme ja-regel som den daglige mail, og højst én engangsmail om året.
  assert.match(m, /notification_prefs -> 'email' ->> 'opdagelse', ''\) = 'true'/);
  assert.match(m, /l\.kind = 'winback'[\s\S]*interval '365 days'/);
  assert.match(m, /match_fits_watcher_level/);
  assert.match(m, /user_blocks/);
});

// --- Engangsmailen ------------------------------------------------------------

const MATCH = {
  id: 'm1', date: '2026-09-28', time: '21:00', time_end: '23:30', court_name: null, court_id: null,
  level_range: 'elo:933-1000|booked:no', current_players: 1, max_players: 4, price_per_person: null, creator_id: 'c1',
};
const PLAYERS = {
  c1: { id: 'c1', full_name: 'Mike Hansen', name: null, level: 3.5, area: 'Nordjylland', court_side: null },
  p1: { id: 'p1', full_name: 'Mia Mogensen', name: null, level: 3.3, area: 'Region Nordjylland', court_side: 'venstre' },
};

test('engangsmail med kampe og spillere: kort, emne og mærke', () => {
  const email = buildWinbackEmail(
    { matchIds: ['m1', 'slettet'], playerIds: ['p1'] },
    { ...OPTS, kilde: 'winback' },
    { recipientName: 'kevin', matches: { m1: MATCH }, players: PLAYERS, todayLabel: 'Torsdag 24. september' },
  );
  assert.equal(email.matchCount, 1, 'en slettet kamp vises ikke');
  assert.equal(email.playerCount, 1);
  assert.equal(email.subject, 'Kevin, 1 kamp og 1 makker på dit niveau nær dig');
  assert.match(email.html, /Hej Kevin/);
  assert.match(email.html, /Mia Mogensen/);
  assert.match(email.html, /Meld dig til/);
  assert.match(email.html, /Nyt i PadelMakker/);
  assert.match(email.html, /Du får denne mail én gang/);
  const appLinks = [...email.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((h) => h.includes('/dashboard'));
  for (const h of appLinks) assert.match(h, /[?&]kilde=winback$/, h);
  assert.match(email.text, /Jeg vil spille: https:\/\/www\.padelmakker\.dk\/dashboard\?kilde=winback/);
  assert.match(email.text, /Afmeld mails med ét klik: https:\/\/x\.supabase\.co/);
});

test('engangsmail uden noget i nærheden: kun det nye i appen', () => {
  const email = buildWinbackEmail({ matchIds: [], playerIds: [] }, OPTS, { recipientName: 'Anna', todayLabel: 'x' });
  assert.equal(email.matchCount + email.playerCount, 0);
  assert.equal(email.subject, 'Anna, nu er det nemmere at finde nogen at spille padel med');
  assert.doesNotMatch(email.html, /Kampe der passer til dig|Spillere der søger makker/);
  for (const n of WINBACK_NEWS) assert.ok(email.html.includes(n.title));
  assert.match(email.html, /Jeg vil spille →/);
});

test('send-winback kører ikke af sig selv og holder alle spærrer', () => {
  const fn = read('supabase/functions/send-winback/index.ts');
  assert.match(fn, /x-cron-secret/);
  assert.match(fn, /dryRun/);
  assert.match(fn, /p_kind: "discovery"/, 'højst én mail om dagen');
  assert.match(fn, /p_kind: "winback"/, 'højst én engangsmail om året');
  assert.match(fn, /List-Unsubscribe-Post/);
  assert.match(fn, /includeEmpty === true/, 'kun med kampe/spillere, medmindre man beder om andet');
  const migrations = readdirSync(join(root, 'supabase/migrations')).map((f) => read(`supabase/migrations/${f}`));
  assert.ok(!migrations.some((s) => /cron\.schedule[\s\S]{0,400}send-winback/.test(s)), 'intet cron-job for send-winback');
});

// --- Admin-kortet -------------------------------------------------------------

test('admin-kortet viser alle mail-slags, også dem med 0', () => {
  const rows = mailReturnRows({ returns: [{ kilde: 'digest', personer: 3, besoeg: 5 }, { kilde: 'ny', personer: 1, besoeg: 1 }], sent: { discovery: 25 } });
  assert.deepEqual(rows.map((r) => [r.kilde, r.personer]), [['digest', 3], ['opdagelse', 0], ['paamindelse', 0], ['winback', 0], ['ny', 1]]);
  assert.equal(mailSentSummary({ sent: { discovery: 25 } }), 'Sendt: 25 almindelige mails');
  assert.equal(mailSentSummary({ sent: { discovery: 1, winback: 30 } }), 'Sendt: 1 almindelig mail og 30 engangsmails');
  assert.equal(mailReturnRows(null).length, 4);
});

test('privatlivspolitikken fortæller om mærket', () => {
  assert.match(read('src/pages/PrivacyPage.jsx'), /Links i vores mails har et lille mærke/);
});
