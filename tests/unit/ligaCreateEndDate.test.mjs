/**
 * "Opret liga" fejlede, fordi formularen ikke sender en slutdato, og
 * leagues.end_date er NOT NULL (ejeren 25. sep. 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLeagueEndDate } from '../../src/lib/ligaCreateDefaults.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('månedlig liga uden slutdato slutter samme dato næste måned', () => {
  assert.equal(resolveLeagueEndDate('2026-09-30', '', 'monthly'), '2026-10-30');
  assert.equal(resolveLeagueEndDate('2026-01-31', null, 'monthly'), '2026-02-28');
  assert.equal(resolveLeagueEndDate('2028-01-31', null, 'monthly'), '2028-02-29');
  assert.equal(resolveLeagueEndDate('2026-12-15', '', 'monthly'), '2027-01-15');
});

test('ugentlig liga uden slutdato slutter 7 dage efter start', () => {
  assert.equal(resolveLeagueEndDate('2026-09-28', '', 'weekly'), '2026-10-05');
});

test('en gyldig valgt slutdato bruges; en slutdato før start ignoreres', () => {
  assert.equal(resolveLeagueEndDate('2026-09-30', '2026-11-15', 'monthly'), '2026-11-15');
  assert.equal(resolveLeagueEndDate('2026-09-30', '2026-09-01', 'monthly'), '2026-10-30');
  assert.equal(resolveLeagueEndDate('', '', 'monthly'), null);
});

test('LigaTab sender altid en slutdato med', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /end_date: endDate,/);
  assert.doesNotMatch(src, /end_date: createForm\.end_date \|\| null/);
});
