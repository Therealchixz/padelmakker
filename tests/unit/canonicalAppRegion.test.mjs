import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { canonicalAppRegion, APP_REGIONS } from '../../src/lib/appRegions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SQL_PATH = 'supabase/sql/canonical_app_region_notify_fix.sql';

test('canonicalAppRegion samler legacy-regioner til app-landsdele', () => {
  assert.equal(canonicalAppRegion('Region Nordjylland'), 'Nordjylland');
  assert.equal(canonicalAppRegion('Nordjylland'), 'Nordjylland');
  assert.equal(canonicalAppRegion('  nordjylland  '), 'Nordjylland');
  assert.equal(canonicalAppRegion('Region Hovedstaden'), 'Hovedstaden');
  assert.equal(canonicalAppRegion('København'), 'Hovedstaden');
  assert.equal(canonicalAppRegion('Region Sjælland'), 'Sjælland');
  assert.equal(canonicalAppRegion('Region Syddanmark'), 'Sydjylland');
  assert.equal(canonicalAppRegion('Sønderjylland'), 'Sydjylland');
  assert.equal(canonicalAppRegion('Region Midtjylland'), 'Østjylland');
});

test('canonicalAppRegion er idempotent for alle app-landsdele', () => {
  for (const region of APP_REGIONS) {
    assert.equal(canonicalAppRegion(region), region);
    assert.equal(canonicalAppRegion(canonicalAppRegion(region)), region);
  }
});

test('canonicalAppRegion lader ukendte værdier stå urørt', () => {
  assert.equal(canonicalAppRegion(''), '');
  assert.equal(canonicalAppRegion(null), '');
  assert.equal(canonicalAppRegion('Ukendt Sted'), 'Ukendt Sted');
});

test('SQL definerer canonical_app_region og bruger den i begge notify-RPC', () => {
  const sql = readFileSync(join(root, SQL_PATH), 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_app_region\(p_area text\)/);
  assert.match(sql, /v_subject_region := public\.canonical_app_region\(/);
  assert.match(sql, /v_subject\.area/);
  assert.match(sql, /v_creator_region := public\.canonical_app_region\(v_creator\.area\)/);
  assert.match(sql, /public\.canonical_app_region\(p\.area\) = v_creator_region/);
});

test('notify-RPC sammenligner ikke længere regioner som rå tekst', () => {
  const sql = readFileSync(join(root, SQL_PATH), 'utf8');
  assert.doesNotMatch(sql, /lower\(v_watcher_region\)\s*<>\s*lower\(trim\(/);
  assert.doesNotMatch(sql, /lower\(trim\(COALESCE\(p\.area, ''\)\)\)\s*=\s*lower\(trim\(/);
});

test('SQL og JS bruger samme legacy-mapping (drift-guard)', () => {
  const sql = readFileSync(join(root, SQL_PATH), 'utf8');
  const pairs = [
    ...sql.matchAll(/IF v_lower = '([^']+)'\s*THEN RETURN '([^']+)';/g),
  ].map(([, input, output]) => ({ input, output }));

  assert.ok(pairs.length >= 7, `forventede legacy-mappings i ${SQL_PATH}, fandt ${pairs.length}`);
  for (const { input, output } of pairs) {
    assert.equal(
      canonicalAppRegion(input),
      output,
      `canonicalAppRegion(${JSON.stringify(input)}) skal give ${output} som i SQL`
    );
  }
});
