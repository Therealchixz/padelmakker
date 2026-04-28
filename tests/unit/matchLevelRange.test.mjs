import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMatchLevelRange,
  clampElo,
  parseMatchLevelRange,
} from '../../src/lib/matchLevelRange.js';

test('clampElo keeps values inside the allowed ELO range', () => {
  assert.equal(clampElo(350), 400);
  assert.equal(clampElo(3200), 3000);
  assert.equal(clampElo('1044.7'), 1045);
  assert.equal(clampElo('ikke-tal', 987), 987);
});

test('parseMatchLevelRange reads the current encoded format', () => {
  assert.deepEqual(parseMatchLevelRange('elo:1200-900|booked:yes'), {
    min: 900,
    max: 1200,
    booked: true,
  });
  assert.deepEqual(parseMatchLevelRange('booked:no'), {
    min: null,
    max: null,
    booked: false,
  });
});

test('parseMatchLevelRange supports old range formats', () => {
  assert.deepEqual(parseMatchLevelRange('800-1100'), {
    min: 800,
    max: 1100,
    booked: null,
  });
  assert.deepEqual(parseMatchLevelRange('1000'), {
    min: 1000,
    max: 1000,
    booked: null,
  });
  assert.deepEqual(parseMatchLevelRange(''), {
    min: null,
    max: null,
    booked: null,
  });
});

test('buildMatchLevelRange stores sorted ELO bounds and booked state', () => {
  assert.equal(buildMatchLevelRange(1300, 900, true, 1000), 'elo:900-1300|booked:yes');
  assert.equal(buildMatchLevelRange('', '', false, 1044), 'elo:944-1144|booked:no');
});
