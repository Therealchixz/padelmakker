/**
 * Ejeren 7. okt. 2026 fik "I matcher som makkere" om en spiller i Herning,
 * ca. 120 km fra Nørresundby, fordi Vestjylland er nabo til Nordjylland.
 * Beskeder om nye makkere og kampe går nu kun til spillere inden for 50 km
 * (eller samme landsdel, når en by mangler).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(root, 'supabase/migrations');
const file = readdirSync(dir).filter((f) => f.endsWith('_notify_within_50km.sql')).pop();
const sql = file ? readFileSync(join(dir, file), 'utf8') : '';

function fnBody(name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `mangler ${name}`);
  return sql.slice(start, sql.indexOf('$fn$;', start));
}

test('migrationen findes', () => {
  assert.ok(file, 'mangler migration *_notify_within_50km.sql');
});

test('grænsen er 50 km, og uden by gælder kun samme landsdel', () => {
  const reach = fnBody('notify_within_reach');
  assert.match(reach, /\) <= 50\b/);
  assert.match(reach, /ELSE COALESCE\(NULLIF\(p_b_filter_region, ''\), NULLIF\(p_b_home_region, ''\), ''\) = p_a_region/);
  assert.doesNotMatch(reach, /app_region_neighbours/, 'nabo-landsdele må ikke længere tælle');
});

test('en bevidst valgt anden landsdel i filteret respekteres', () => {
  const reach = fnBody('notify_within_reach');
  assert.match(reach, /p_b_filter_region <> p_b_home_region\s+THEN COALESCE\(p_a_region, ''\) <> '' AND p_a_region = p_b_filter_region/);
});

test('(0, 0) tæller ikke som en rigtig placering', () => {
  assert.match(fnBody('notify_distance_km'), /abs\(p_a_lat\) < 0\.01 AND abs\(p_a_lng\) < 0\.01/);
});

for (const fn of ['notify_makker_watchers', 'notify_match_watchers']) {
  test(`${fn} bruger afstand i stedet for nabo-landsdele`, () => {
    const body = fnBody(fn);
    assert.doesNotMatch(body, /app_region_neighbours|v_regions/, 'nabo-landsdele må ikke bruges');
    assert.ok((body.match(/public\.notify_within_reach\(/g) || []).length >= 2, 'begge modtager-grupper skal tjekkes');
    assert.match(body, /public\.notify_distance_km\([^)]*\) ASC NULLS LAST/, 'nærmeste skal komme først');
  });
}

test('hjælperne kan ikke kaldes af brugere', () => {
  for (const sig of [
    'notify_distance_km(double precision, double precision, double precision, double precision)',
    'notify_within_reach(double precision, double precision, text, double precision, double precision, text, text)',
  ]) {
    assert.ok(sql.includes(`REVOKE ALL ON FUNCTION public.${sig} FROM PUBLIC, anon, authenticated;`), sig);
  }
});

test('filtersiden fortæller den samme regel som databasen', async () => {
  const { notifyReachLabel } = await import('../../src/lib/appRegions.js');
  const mike = { area: 'Nordjylland', city: 'Nørresundby', latitude: 57.06, longitude: 9.92 };
  assert.equal(notifyReachLabel('Nordjylland', mike), 'Besked om spillere inden for ca. 50 km af Nørresundby');
  assert.equal(notifyReachLabel('Østjylland', mike), 'Besked om spillere i Østjylland');
  assert.equal(notifyReachLabel('Nordjylland', { area: 'Nordjylland' }), 'Besked om spillere i Nordjylland');
  for (const rel of ['src/dashboard/MakkerSearchFilterPage.jsx', 'src/dashboard/MatchSearchFilterPage.jsx', 'src/components/RegionPickerRow.jsx']) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert.doesNotMatch(src, /nabo-region/, `${rel}: teksten om nabo-regioner er ikke længere sand`);
  }
});
