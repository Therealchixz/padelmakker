import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLandingStatCount,
  normalizeLandingPublicStats,
  buildLandingStatsItems,
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

test('buildLandingStatsItems never shows a dash or zero', () => {
  const items = buildLandingStatsItems({ player_count: 118, open_matches: 0, matches_last_30_days: 0 });
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((i) => i.n), ['118', '150+', '4', 'Gratis']);
  for (const it of items) {
    assert.notEqual(it.n, '—');
    assert.notEqual(it.n, '0');
  }
});

test('buildLandingStatsItems shows live counts once they are big enough', () => {
  const items = buildLandingStatsItems({ player_count: 400, open_matches: 12, matches_last_30_days: 90 });
  assert.deepEqual(items.map((i) => i.l), [
    'Spillere på platformen',
    'Åbne kampe lige nu',
    'Kampe spillet de sidste 30 dage',
    'Opret profil uden betaling',
  ]);
});

test('buildLandingStatsItems falls back to facts when stats are missing', () => {
  const items = buildLandingStatsItems(null);
  assert.deepEqual(items.map((i) => i.n), ['150+', '4', 'ELO', 'Gratis']);
});
