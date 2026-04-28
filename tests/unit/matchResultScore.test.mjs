import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMatchResultScore,
  formatSubmittedPadelScore,
} from '../../src/lib/matchResultScore.js';

test('formatSubmittedPadelScore includes tiebreak points for submitted sets', () => {
  const score = formatSubmittedPadelScore([
    { gamesTeam1: 6, gamesTeam2: 2 },
    { gamesTeam1: 2, gamesTeam2: 6 },
    { gamesTeam1: 6, gamesTeam2: 7, tiebreakTeam1: 5, tiebreakTeam2: 7 },
  ]);

  assert.equal(score, '6-2, 2-6, 6-7 (TB 5-7)');
});

test('formatMatchResultScore reconstructs tiebreak display from database columns', () => {
  const score = formatMatchResultScore({
    score_display: '6-2, 2-6, 6-7',
    set1_team1: 6,
    set1_team2: 2,
    set2_team1: 2,
    set2_team2: 6,
    set3_team1: 6,
    set3_team2: 7,
    set3_tb1: 5,
    set3_tb2: 7,
  });

  assert.equal(score, '6-2, 2-6, 6-7 (TB 5-7)');
});

test('formatMatchResultScore falls back to stored score_display when set columns are missing', () => {
  assert.equal(formatMatchResultScore({ score_display: '6-3' }), '6-3');
});
