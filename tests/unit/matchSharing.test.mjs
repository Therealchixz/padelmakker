/**
 * Del kampe med venner (WhatsApp, Messenger, SMS) + påmindelse kun ved nyt.
 *
 * Før: "En spiller inviterer dig til en padel-kamp på padel. Log ind eller
 * opret gratis profil ..." - uden dag, niveau eller hvor mange der mangler, og
 * WhatsApp viste forsidens standardkort, fordi den ikke kører JavaScript.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMatchShareText,
  matchPreviewMeta,
  shareMatchUrl,
  shareWhenLabel,
  shareCourtLabel,
} from '../../src/lib/matchShareText.js';
import { renderMatchPreviewHtml, escapeHtmlAttr } from '../../padelmakker-server/routes/matchPreview.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const QUICK = {
  id: '6012e22f-7ac6-4a26-beb2-80f0537ac617', date: '2026-09-28', time: '21:00', time_end: '23:30',
  court_name: '', level_range: 'elo:933-1000|booked:no', current_players: 1, max_players: 4,
};

test('delingsteksten siger hvornår, niveau og hvor mange der mangler', () => {
  assert.equal(
    buildMatchShareText(QUICK),
    'Vi mangler 3 spillere til padel mandag 28. sep kl. 21:00–23:30 🎾\nNiveau 3.0 – 4.0\nMeld dig til her (gratis):',
  );
  const booked = { ...QUICK, court_name: 'Skansen Padel', current_players: 3 };
  assert.match(buildMatchShareText(booked), /^Vi mangler 1 spiller til padel/);
  assert.match(buildMatchShareText(booked), /Niveau 3\.0 – 4\.0 · Skansen Padel/);
});

test('"Padel" som banenavn (fra public_match_preview) vises ikke som en bane', () => {
  assert.equal(shareCourtLabel({ court_name: 'Padel' }), '');
  assert.equal(shareCourtLabel({ court_name: ' ' }), '');
  assert.equal(shareWhenLabel({ date: '2026-09-28' }), 'mandag 28. sep');
  assert.equal(shareWhenLabel({ time: '9:5x' }), '');
});

test('delt link har ?kilde=deling, så admin-kortet kan tælle det', () => {
  assert.equal(shareMatchUrl('https://www.padelmakker.dk/', 'abc'), 'https://www.padelmakker.dk/kamp/abc?kilde=deling');
  const utils = read('src/lib/shareUtils.js');
  assert.match(utils, /buildMatchShareText\(match\)/);
  assert.match(utils, /shareMatchUrl\(SITE_ORIGIN, match\.id\)/);
  // Én samlet besked: linket står i teksten, ikke som separat url (Messenger
  // sendte ellers to beskeder med linket først).
  const fn = utils.slice(utils.indexOf('export async function sharePadelMatch'));
  assert.doesNotMatch(fn.slice(0, fn.indexOf('\n}\n')), /\burl:/);
  assert.match(read('src/components/kampe/CreatedMatchReceipt.jsx'), /shareMatchUrl\(SITE_ORIGIN, m\.id\)/);
});

test('kvitteringen efter oprettelse har en tydelig "Send til venner"-knap', () => {
  const r = read('src/components/kampe/CreatedMatchReceipt.jsx');
  assert.match(r, /Send til venner/);
  assert.match(r, /WhatsApp, Messenger eller SMS/);
});

test('kortet i WhatsApp: titel og tekst ud fra kampen', () => {
  const meta = matchPreviewMeta({ ...QUICK, court_name: 'Padel', creator_first_name: 'Mike' });
  assert.equal(meta.title, 'Padel mandag 28. sep kl. 21:00–23:30 · mangler 3 spillere');
  assert.equal(meta.description, 'Niveau 3.0 – 4.0 · Bane ikke valgt endnu · Oprettet af Mike. Meld dig til gratis på PadelMakker.');
  assert.match(matchPreviewMeta({ ...QUICK, current_players: 4 }).title, /· fuld$/);
});

test('forhåndsvisningen escaper alt og peger på kampsiden', () => {
  const html = renderMatchPreviewHtml({ title: 'A "<b>"', description: 'x & y', url: 'https://x/kamp/1?kilde=deling', image: 'https://x/i.png' });
  assert.match(html, /<meta property="og:title" content="A &quot;&lt;b&gt;&quot;">/);
  assert.match(html, /content="x &amp; y"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/x\/kamp\/1\?kilde=deling">/);
  assert.equal(escapeHtmlAttr('<'), '&lt;');
});

test('kun link-robotter sendes til forhåndsvisningen, og før app-reglen', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const i = vercel.rewrites.findIndex((r) => r.source === '/kamp/:matchId');
  const spa = vercel.rewrites.findIndex((r) => r.destination === '/index.html');
  assert.ok(i >= 0 && i < spa, 'robot-reglen skal stå før index.html-reglen');
  const rule = vercel.rewrites[i];
  assert.equal(rule.destination, '/api/kamp-preview?id=:matchId');
  const ua = new RegExp(rule.has[0].value);
  assert.ok(ua.test('WhatsApp/2.23.20 A'));
  assert.ok(ua.test('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'));
  assert.ok(!ua.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'));
  assert.ok(!ua.test('Mozilla/5.0 (compatible; Googlebot/2.1)'), 'søgemaskiner får den rigtige side');
  assert.match(read('api/[slug].js'), /case 'kamp-preview':\n\s+return handleMatchPreview/);
});

test('den offentlige kampside viser hvor mange der mangler, ikke "Padel" som overskrift', () => {
  const page = read('src/pages/PublicMatchPage.jsx');
  assert.match(page, /Mangler \$\{left\}/);
  assert.match(page, /court \|\| 'Bane ikke valgt endnu'/);
  assert.match(page, /matchPreviewMeta\(row\)/);
});

test('påmindelsen sendes kun, når der er noget nyt siden sidst', () => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_reactivation_only_when_new.sql')).pop();
  assert.ok(f);
  const m = readFileSync(join(dir, f), 'utf8');
  assert.match(m, /and t\.new_count >= 1/);
  assert.match(m, /om\.created_at > c\.last_nudge_at/);
  assert.match(m, /s\.seeking_match_at > c\.last_nudge_at/);
  assert.match(m, /l\.kind = 'winback'/, 'engangsmailen tæller også som "sidst"');
  assert.match(m, /REVOKE ALL ON FUNCTION public\.get_due_reactivation_nudges\(\) FROM anon;/);
});
