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
  assert.equal(stats.toughestPartners.length, 0);
  assert.equal(stats.hardestOpponents.length, 0);
  assert.ok(['bob', 'cam'].includes(stats.easiestOpponents[0].userId));
});

test('aggregateLigaRelationStats does not duplicate best partner in toughest list', () => {
  const teamsById = {
    tMeHans: {
      id: 'tMeHans',
      status: 'ready',
      player1_id: 'me',
      player2_id: 'hans',
      player1_name: 'Me',
      player2_name: 'Hans Hansen',
    },
    tMeKevin: {
      id: 'tMeKevin',
      status: 'ready',
      player1_id: 'me',
      player2_id: 'kevin',
      player1_name: 'Me',
      player2_name: 'Kevin Rastung',
    },
    tOpp: {
      id: 'tOpp',
      status: 'ready',
      player1_id: 'x1',
      player2_id: 'x2',
      player1_name: 'X1',
      player2_name: 'X2',
    },
  };
  const matches = [
    { id: 'm1', status: 'reported', team1_id: 'tMeHans', team2_id: 'tOpp', winner_id: 'tMeHans' },
    { id: 'm2', status: 'reported', team1_id: 'tMeHans', team2_id: 'tOpp', winner_id: 'tMeHans' },
    { id: 'm3', status: 'reported', team1_id: 'tMeHans', team2_id: 'tOpp', winner_id: 'tOpp' },
    { id: 'm4', status: 'reported', team1_id: 'tMeKevin', team2_id: 'tOpp', winner_id: 'tMeKevin' },
    { id: 'm5', status: 'reported', team1_id: 'tMeKevin', team2_id: 'tOpp', winner_id: 'tOpp' },
  ];

  const stats = aggregateLigaRelationStats({ matches, teamsById, userId: 'me' });

  assert.equal(stats.bestPartners[0].userId, 'hans');
  assert.equal(stats.toughestPartners.length, 1);
  assert.equal(stats.toughestPartners[0].userId, 'kevin');
  assert.ok(!stats.toughestPartners.some((p) => p.userId === 'hans'));
});
