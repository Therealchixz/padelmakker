import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLandingStatCount,
  normalizeLandingPublicStats,
} from '../../src/lib/landingStatsDisplay.js';

test('normalizeLandingPublicStats parses RPC payload', () => {
  const stats = normalizeLandingPublicStats({
    player_count: 42,
    open_matches: 3,
    matches_last_30_days: 120,
  });
  assert.deepEqual(stats, {
    player_count: 42,
    open_matches: 3,
    matches_last_30_days: 120,
  });
});

test('formatLandingStatCount uses locale string for positive counts', () => {
  assert.equal(formatLandingStatCount(0), '—');
  const formatted = formatLandingStatCount(1250);
  assert.match(formatted, /1[.,\s]?250/);
});
