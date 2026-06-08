import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const home = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../src/dashboard/HomeTab.jsx'),
  'utf8',
);

test('seneste aktivitet bruger kompakte pill-filtre med kort americano-label', () => {
  assert.match(home, /shortLabel: 'Am\/Mex'/);
  assert.match(home, /pm-feed-filters-tabs/);
  assert.match(home, /pm-pill-tab pm-pill-tab--sm/);
  assert.doesNotMatch(home, /pm-ui-btn-chip pm-feed-filter-chip pm-ui-btn-chip-active/);
});
