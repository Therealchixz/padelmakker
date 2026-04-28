import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateMatchRosterForElo,
  validateSubmittedPadelResult,
} from '../../src/lib/padelResultGuards.js';

const teamOf = (player) => Number(player.team);

test('validateMatchRosterForElo accepts exactly two unique players on each team', () => {
  const roster = [
    { user_id: 'a', team: 1 },
    { user_id: 'b', team: 1 },
    { user_id: 'c', team: 2 },
    { user_id: 'd', team: 2 },
  ];

  assert.equal(validateMatchRosterForElo(roster, teamOf).ok, true);
});

test('validateMatchRosterForElo rejects uneven teams before ELO can be applied', () => {
  const roster = [
    { user_id: 'a', team: 1 },
    { user_id: 'b', team: 1 },
    { user_id: 'c', team: 1 },
    { user_id: 'd', team: 2 },
  ];

  const result = validateMatchRosterForElo(roster, teamOf);
  assert.equal(result.ok, false);
  assert.match(result.reason, /2 spillere på hvert hold/i);
});

test('validateMatchRosterForElo rejects duplicate player rows', () => {
  const roster = [
    { user_id: 'a', team: 1 },
    { user_id: 'a', team: 1 },
    { user_id: 'c', team: 2 },
    { user_id: 'd', team: 2 },
  ];

  const result = validateMatchRosterForElo(roster, teamOf);
  assert.equal(result.ok, false);
  assert.match(result.reason, /samme spiller/i);
});

test('validateSubmittedPadelResult accepts a valid one-set match', () => {
  const result = validateSubmittedPadelResult({
    winner: 'team1',
    completed: true,
    sets: [{ setNumber: 1, gamesTeam1: 6, gamesTeam2: 3 }],
  });

  assert.equal(result.ok, true);
});

test('validateSubmittedPadelResult rejects invalid padel set scores', () => {
  const result = validateSubmittedPadelResult({
    winner: 'team1',
    completed: true,
    sets: [{ setNumber: 1, gamesTeam1: 6, gamesTeam2: 5 }],
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /ugyldigt/i);
});

test('validateSubmittedPadelResult rejects a winner that does not match the sets', () => {
  const result = validateSubmittedPadelResult({
    winner: 'team2',
    completed: true,
    sets: [{ setNumber: 1, gamesTeam1: 6, gamesTeam2: 2 }],
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /vinder/i);
});
