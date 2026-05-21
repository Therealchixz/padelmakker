import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('seeking player uses elo_history and resolveElo, not profiles.elo_rating filter', () => {
  const src = readFileSync(join(root, 'src/lib/seekingPlayerUtils.js'), 'utf8');
  assert.match(src, /fetchEloByUserIdFromHistory/);
  assert.match(src, /resolveElo/);
  assert.doesNotMatch(src, /\.gte\('elo_rating'/);
  assert.match(src, /displayElo\(creatorProfile, eloByUserId\)/);
});

test('KampeTab passes preloaded elo history into activateSeekingPlayer', () => {
  const src = readFileSync(join(root, 'src/dashboard/KampeTab.jsx'), 'utf8');
  assert.match(src, /eloFromHistoryByUserId/);
  assert.match(src, /activateSeekingPlayer\([\s\S]*eloByUserId:\s*eloFromHistoryByUserId/s);
  assert.match(src, /ELO \$\{eloMin\}–\$\{eloMax\}/);
});
