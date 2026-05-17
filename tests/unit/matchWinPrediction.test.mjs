import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculate2v2MatchWinPrediction,
  formatWinPredictionPct,
} from '../../src/lib/matchWinPrediction.js';

test('returns null without full 2v2 rosters', () => {
  assert.equal(calculate2v2MatchWinPrediction([], []), null);
  assert.equal(calculate2v2MatchWinPrediction([{ rating: 1000 }], [{ rating: 1000 }, { rating: 1000 }]), null);
});

test('equal teams yield ~50/50', () => {
  const result = calculate2v2MatchWinPrediction(
    [
      { rating: 1000, gamesPlayed: 40 },
      { rating: 1000, gamesPlayed: 40 },
    ],
    [
      { rating: 1000, gamesPlayed: 40 },
      { rating: 1000, gamesPlayed: 40 },
    ],
  );
  assert.ok(result);
  assert.equal(result.team1WinPct, 50);
  assert.equal(result.team2WinPct, 50);
  assert.equal(result.approximate, false);
});

test('stronger team gets higher win chance', () => {
  const result = calculate2v2MatchWinPrediction(
    [
      { rating: 1200, gamesPlayed: 50 },
      { rating: 1180, gamesPlayed: 50 },
    ],
    [
      { rating: 1000, gamesPlayed: 50 },
      { rating: 1020, gamesPlayed: 50 },
    ],
  );
  assert.ok(result);
  assert.ok(result.team1WinPct > 55);
  assert.ok(result.team2WinPct < 45);
});

test('flags approximate when any player has few games', () => {
  const result = calculate2v2MatchWinPrediction(
    [
      { rating: 1100, gamesPlayed: 3 },
      { rating: 1100, gamesPlayed: 40 },
    ],
    [
      { rating: 1000, gamesPlayed: 40 },
      { rating: 1000, gamesPlayed: 40 },
    ],
  );
  assert.ok(result?.approximate);
});

test('formatWinPredictionPct', () => {
  assert.equal(formatWinPredictionPct(58, false), '58%');
  assert.equal(formatWinPredictionPct(58, true), 'ca. 58%');
});
