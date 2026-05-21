import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateAmericanoRelationStats,
  outcomeForUserInAmericanoRound,
} from '../../src/lib/americanoRelationStatsCore.js';

test('outcomeForUserInAmericanoRound detects win on team A', () => {
  const map = new Map([
    ['p1', 'u1'],
    ['p2', 'u2'],
    ['p3', 'u3'],
    ['p4', 'u4'],
  ]);
  const outcome = outcomeForUserInAmericanoRound(
    {
      team_a_p1: 'p1',
      team_a_p2: 'p2',
      team_b_p1: 'p3',
      team_b_p2: 'p4',
      team_a_score: 16,
      team_b_score: 0,
    },
    map,
    'u1',
    16,
  );
  assert.equal(outcome, 'win');
});

test('aggregateAmericanoRelationStats ranks partners and opponents', () => {
  const participants = [
    { id: 'p1', tournament_id: 't1', user_id: 'me', display_name: 'Me' },
    { id: 'p2', tournament_id: 't1', user_id: 'ace', display_name: 'Ace' },
    { id: 'p3', tournament_id: 't1', user_id: 'bob', display_name: 'Bob' },
    { id: 'p4', tournament_id: 't1', user_id: 'cam', display_name: 'Cam' },
  ];
  const matches = [
    {
      tournament_id: 't1',
      team_a_p1: 'p1',
      team_a_p2: 'p2',
      team_b_p1: 'p3',
      team_b_p2: 'p4',
      team_a_score: 16,
      team_b_score: 0,
    },
    {
      tournament_id: 't1',
      team_a_p1: 'p1',
      team_a_p2: 'p2',
      team_b_p1: 'p3',
      team_b_p2: 'p4',
      team_a_score: 16,
      team_b_score: 0,
    },
    {
      tournament_id: 't1',
      team_a_p1: 'p1',
      team_a_p2: 'p3',
      team_b_p1: 'p2',
      team_b_p2: 'p4',
      team_a_score: 0,
      team_b_score: 16,
    },
    {
      tournament_id: 't1',
      team_a_p1: 'p1',
      team_a_p2: 'p3',
      team_b_p1: 'p2',
      team_b_p2: 'p4',
      team_a_score: 0,
      team_b_score: 16,
    },
  ];

  const stats = aggregateAmericanoRelationStats({
    matches,
    participants,
    pointsPerMatchByTournamentId: { t1: 16 },
    userId: 'me',
  });

  assert.equal(stats.bestPartners[0].userId, 'ace');
  assert.equal(stats.bestPartners[0].asPartner.wins, 2);
  assert.equal(stats.toughestPartners[0].userId, 'bob');
  assert.equal(stats.hardestOpponents[0].userId, 'ace');
  assert.ok(['bob', 'cam'].includes(stats.easiestOpponents[0].userId));
});
