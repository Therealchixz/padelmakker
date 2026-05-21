import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateLigaRelationStats } from '../../src/lib/ligaRelationStatsCore.js';

test('aggregateLigaRelationStats ranks liga partners and opponents', () => {
  const teamsById = {
    tMe: {
      id: 'tMe',
      status: 'ready',
      player1_id: 'me',
      player2_id: 'ace',
      player1_name: 'Me',
      player2_name: 'Ace',
    },
    tBob: {
      id: 'tBob',
      status: 'ready',
      player1_id: 'bob',
      player2_id: 'cam',
      player1_name: 'Bob',
      player2_name: 'Cam',
    },
  };
  const matches = [
    { id: 'm1', status: 'reported', team1_id: 'tMe', team2_id: 'tBob', winner_id: 'tMe' },
    { id: 'm2', status: 'reported', team1_id: 'tMe', team2_id: 'tBob', winner_id: 'tMe' },
    { id: 'm3', status: 'reported', team1_id: 'tBob', team2_id: 'tMe', winner_id: 'tBob' },
    { id: 'm4', status: 'reported', team1_id: 'tBob', team2_id: 'tMe', winner_id: 'tBob' },
  ];

  const stats = aggregateLigaRelationStats({ matches, teamsById, userId: 'me' });

  assert.equal(stats.bestPartners[0].userId, 'ace');
  assert.equal(stats.toughestPartners[0].userId, 'ace');
  assert.equal(stats.hardestOpponents[0].userId, 'bob');
  assert.ok(['bob', 'cam'].includes(stats.easiestOpponents[0].userId));
});
