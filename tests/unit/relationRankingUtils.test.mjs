import test from 'node:test';
import assert from 'node:assert/strict';

import { pickHardestOpponents, pickToughestByWinRate } from '../../src/lib/relationRankingUtils.js';

test('pickToughestByWinRate excludes partners with the best win rate', () => {
  const eligible = [
    { userId: 'hans', rate: 0.67 },
    { userId: 'kevin', rate: 0.5 },
  ];
  const rateFn = (p) => p.rate;

  const toughest = pickToughestByWinRate(eligible, rateFn, 3);
  assert.deepEqual(
    toughest.map((p) => p.userId),
    ['kevin'],
  );
});

test('pickToughestByWinRate returns empty with only one partner', () => {
  const eligible = [{ userId: 'solo', rate: 0.5 }];
  assert.equal(pickToughestByWinRate(eligible, (p) => p.rate).length, 0);
});

test('pickHardestOpponents excludes easiest opponents', () => {
  const eligible = [
    { userId: 'a', rate: 0.8 },
    { userId: 'b', rate: 0.2 },
  ];
  const hardest = pickHardestOpponents(eligible, (p) => p.rate, 3);
  assert.deepEqual(hardest.map((p) => p.userId), ['b']);
});
