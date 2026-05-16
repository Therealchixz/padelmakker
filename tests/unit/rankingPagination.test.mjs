import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rankingPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/dashboard/RankingTab.jsx',
);

test('RankingTab loads profiles in pages of 50 with load more', () => {
  const src = readFileSync(rankingPath, 'utf8');
  assert.match(src, /RANKING_PAGE_SIZE = 50/);
  assert.match(src, /Indlæs \$\{RANKING_PAGE_SIZE\} flere/);
  assert.match(src, /\.range\(from, to\)/);
});

test('RankingTab only loads elo history for week and month periods', () => {
  const src = readFileSync(rankingPath, 'utf8');
  assert.match(src, /if \(period === 'all'\)/);
  assert.match(src, /await loadPeriodHistory\(\)/);
  assert.match(src, /setEloHistory\(\[\]\)/);
});
