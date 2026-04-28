import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMatchResultInsertPayload } from '../../src/lib/matchResultPayload.js';

const players = [
  { user_id: 'team1-a', team: 1 },
  { user_id: 'team1-b', team: 1 },
  { user_id: 'team2-a', team: 2 },
  { user_id: 'team2-b', team: 2 },
];

test('buildMatchResultInsertPayload stores set columns, tiebreaks, score display and players', () => {
  const payload = buildMatchResultInsertPayload({
    matchId: 'match-1',
    players,
    submittedBy: 'team1-a',
    result: {
      winner: 'team2',
      completed: true,
      sets: [
        { setNumber: 1, gamesTeam1: 6, gamesTeam2: 2 },
        { setNumber: 2, gamesTeam1: 2, gamesTeam2: 6 },
        { setNumber: 3, gamesTeam1: 6, gamesTeam2: 7, tiebreakTeam1: 5, tiebreakTeam2: 7 },
      ],
    },
  });

  assert.deepEqual(payload, {
    match_id: 'match-1',
    team1_player1_id: 'team1-a',
    team1_player2_id: 'team1-b',
    team2_player1_id: 'team2-a',
    team2_player2_id: 'team2-b',
    set1_team1: 6,
    set1_team2: 2,
    set1_tb1: undefined,
    set1_tb2: undefined,
    set2_team1: 2,
    set2_team2: 6,
    set2_tb1: undefined,
    set2_tb2: undefined,
    set3_team1: 6,
    set3_team2: 7,
    set3_tb1: 5,
    set3_tb2: 7,
    sets_won_team1: 1,
    sets_won_team2: 2,
    match_winner: 'team2',
    score_display: '6-2, 2-6, 6-7 (TB 5-7)',
    submitted_by: 'team1-a',
    confirmed: false,
  });
});

test('buildMatchResultInsertPayload normalizes 6-6 tiebreak sets before counting sets won', () => {
  const payload = buildMatchResultInsertPayload({
    matchId: 'match-2',
    players,
    submittedBy: 'team1-a',
    result: {
      winner: 'team2',
      completed: true,
      sets: [
        { setNumber: 1, gamesTeam1: 6, gamesTeam2: 6, tiebreakTeam1: 8, tiebreakTeam2: 10 },
      ],
    },
  });

  assert.equal(payload.set1_team1, 6);
  assert.equal(payload.set1_team2, 7);
  assert.equal(payload.set1_tb1, 8);
  assert.equal(payload.set1_tb2, 10);
  assert.equal(payload.sets_won_team1, 0);
  assert.equal(payload.sets_won_team2, 1);
  assert.equal(payload.score_display, '6-7 (TB 8-10)');
});
