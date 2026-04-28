import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentEloFromSortedHistory,
  sortEloHistoryChronological,
  statsFromEloHistoryRows,
  winStreaksFromEloHistory,
} from '../../src/lib/eloHistoryMath.js';

test('statsFromEloHistoryRows derives current ELO from chronological rated rows', () => {
  const rows = [
    {
      id: 'b',
      user_id: 'user-1',
      match_id: 'match-2',
      old_rating: 1018,
      change: -12,
      result: 'loss',
      date: '2026-02-03',
    },
    {
      id: 'a',
      user_id: 'user-1',
      match_id: 'match-1',
      old_rating: 1000,
      change: 18,
      result: 'win',
      date: '2026-02-01',
    },
  ];

  assert.deepEqual(statsFromEloHistoryRows(rows), {
    elo: 1006,
    games: 2,
    wins: 1,
  });
});

test('statsFromEloHistoryRows ignores non-match rows for rated padel stats', () => {
  const rows = [
    {
      id: 'admin-adjustment',
      user_id: 'user-1',
      match_id: null,
      old_rating: null,
      new_rating: null,
      change: 200,
      result: 'adjustment',
      date: '2026-01-01',
    },
    {
      id: 'match-1-row',
      user_id: 'user-1',
      match_id: 'match-1',
      old_rating: 1200,
      change: 16,
      result: 'win',
      date: '2026-01-02',
    },
  ];

  assert.deepEqual(statsFromEloHistoryRows(rows), {
    elo: 1216,
    games: 1,
    wins: 1,
  });
});

test('currentEloFromSortedHistory falls back to new minus old when change is missing', () => {
  const sorted = sortEloHistoryChronological([
    {
      id: 'match-1-row',
      match_id: 'match-1',
      old_rating: 1000,
      new_rating: 1021,
      change: null,
      result: 'win',
      date: '2026-03-01',
    },
  ]);

  assert.equal(currentEloFromSortedHistory(sorted), 1021);
});

test('winStreaksFromEloHistory only counts rated match rows', () => {
  const rows = [
    {
      id: 'match-1-row',
      match_id: 'match-1',
      old_rating: 1000,
      change: 15,
      result: 'win',
      date: '2026-01-01',
    },
    {
      id: 'admin-adjustment',
      match_id: null,
      old_rating: null,
      change: 50,
      result: 'adjustment',
      date: '2026-01-02',
    },
    {
      id: 'match-2-row',
      match_id: 'match-2',
      old_rating: 1065,
      change: 12,
      result: 'win',
      date: '2026-01-03',
    },
  ];

  assert.deepEqual(winStreaksFromEloHistory(rows), {
    currentStreak: 2,
    bestStreak: 2,
  });
});
