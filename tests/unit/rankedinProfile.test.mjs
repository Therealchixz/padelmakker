/**
 * Rankedin på profilen (ejeren 7. okt. 2026): man indsætter sit Rankedin-link,
 * og andre kan se ens Rankedin-side i et vindue i appen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRankedinId, rankedinProfileUrl, isRankedinId } from '../../src/lib/rankedin.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('genkender Rankedin-links og -numre', () => {
  assert.equal(parseRankedinId('https://www.rankedin.com/en/player/R000123456/mike-hansen'), 'R000123456');
  assert.equal(parseRankedinId('rankedin.com/da/player/R000123456'), 'R000123456');
  assert.equal(parseRankedinId('https://rankedin.com/player/R000123456?tab=matches'), 'R000123456');
  assert.equal(parseRankedinId('R000123456'), 'R000123456');
  assert.equal(parseRankedinId('r000123456'), 'R000123456');
});

test('afviser alt andet end Rankedin', () => {
  for (const bad of [
    '',
    'https://evil.com/rankedin.com/player/R000123456',
    'https://notrankedin.com/en/player/R000123456',
    'javascript:alert(1)',
    'https://www.rankedin.com/en/player/R0001',
    'https://www.rankedin.com/en/tournament/123',
  ]) {
    assert.equal(parseRankedinId(bad), null, bad);
  }
  assert.equal(isRankedinId('Z000123456'), false);
});

test('adressen bygges altid af appen selv', () => {
  assert.equal(rankedinProfileUrl('R000123456'), 'https://www.rankedin.com/dk/player/R000123456');
  assert.equal(rankedinProfileUrl('https://evil.com'), null);
  assert.equal(rankedinProfileUrl(null), null);
});

test('databasen tillader kun et Rankedin-nummer, og andre må læse det', () => {
  const f = readdirSync(join(root, 'supabase/migrations')).filter((x) => x.endsWith('_profiles_rankedin_id.sql')).pop();
  assert.ok(f, 'mangler migration');
  const sql = read(`supabase/migrations/${f}`);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS rankedin_id text/);
  assert.match(sql, /CHECK \(rankedin_id IS NULL OR rankedin_id ~ '\^\[D-R\]\[A-Za-z0-9\]\{9,14\}\$'\)/);
  assert.match(sql, /GRANT SELECT \(rankedin_id\) ON public\.profiles TO authenticated;/);
  assert.match(read('src/lib/profileQueries.js'), /'rankedin_id',/);
});

test('vinduet må vise rankedin.com, og intet andet nyt', () => {
  const csp = read('vercel.json');
  assert.match(csp, /frame-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/www\.rankedin\.com;/);
  const sheet = read('src/components/RankedinSheet.jsx');
  assert.match(sheet, /src=\{url\}/);
  assert.match(sheet, /const url = rankedinProfileUrl\(rankedinId\)/);
  assert.doesNotMatch(sheet, /allow-top-navigation/, 'Rankedin må ikke kunne skifte vores side ud');
  assert.match(sheet, /Åbn på Rankedin/, 'reserve-link, hvis Rankedin slår visning i apps fra');
});

test('profilen gemmer og viser Rankedin', () => {
  const tab = read('src/dashboard/ProfilTab.jsx');
  assert.match(tab, /rankedin_id: rankedinId,/);
  assert.match(tab, /Rankedin-linket ser forkert ud/);
  assert.match(read('src/dashboard/PlayerProfileModal.jsx'), /<RankedinButton rankedinId=\{pRef\.rankedin_id\}/);
  assert.match(read('src/pages/PrivacyPage.jsx'), /Rankedin/);
});

test('tilbage-knappen går kun tilbage inde i Rankedin-vinduet', () => {
  // Ejeren 8. okt. 2026: "man kan ikke gå frem eller tilbage". history.back()
  // går tilbage i rammen, men kun så mange skridt, som rammen selv har lagt
  // til — ellers ville "Tilbage" forlade PadelMakker.
  const sheet = read('src/components/RankedinSheet.jsx');
  assert.match(sheet, /if \(steps <= 0\) return;\s*setSteps\(\(n\) => n - 1\);\s*window\.history\.back\(\);/);
  assert.match(sheet, /disabled=\{!canGoBack\}/);
  assert.match(sheet, /aria-label="Tilbage til spillerens forside på Rankedin"/);
  assert.match(sheet, /key=\{frameKey\}/, 'forside-knappen skal genindlæse rammen');
});
