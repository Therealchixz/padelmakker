import test from 'node:test';
import assert from 'node:assert/strict';

import { submitPadelMatchResult } from '../../src/lib/submitPadelMatchResult.js';

const validPlayers = [
  { user_id: 'submitter', team: 1 },
  { user_id: 'partner', team: 1 },
  { user_id: 'opponent-1', team: 2 },
  { user_id: 'opponent-2', team: 2 },
];

function createSupabaseInsertMock() {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        return {
          async insert(payload) {
            calls.push({ table, payload });
            return { error: null };
          },
        };
      },
    },
  };
}

test('submitPadelMatchResult inserts a validated result and notifies the other players', async () => {
  const supabase = createSupabaseInsertMock();
  const notifications = [];

  const result = await submitPadelMatchResult({
    supabaseClient: supabase.client,
    createNotificationFn: async (...args) => {
      notifications.push(args);
      return null;
    },
    matchId: 'match-1',
    players: validPlayers,
    submittedBy: 'submitter',
    submitterName: 'Alice',
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

  assert.equal(result.ok, true);
  assert.equal(result.scoreDisplay, '6-2, 2-6, 6-7 (TB 5-7)');
  assert.equal(supabase.calls.length, 1);
  assert.equal(supabase.calls[0].table, 'match_results');
  assert.equal(supabase.calls[0].payload.score_display, '6-2, 2-6, 6-7 (TB 5-7)');
  assert.equal(supabase.calls[0].payload.submitted_by, 'submitter');

  assert.deepEqual(
    notifications.map((n) => n[0]),
    ['partner', 'opponent-1', 'opponent-2'],
  );
  assert.equal(notifications.every((n) => n[1] === 'result_submitted'), true);
  assert.equal(notifications.every((n) => String(n[3]).includes('6-7 (TB 5-7)')), true);
  assert.equal(notifications.every((n) => n[4] === 'match-1'), true);
});

test('submitPadelMatchResult rejects invalid rosters before database insert', async () => {
  const supabase = createSupabaseInsertMock();
  const notifications = [];

  const result = await submitPadelMatchResult({
    supabaseClient: supabase.client,
    createNotificationFn: async (...args) => notifications.push(args),
    matchId: 'match-1',
    players: validPlayers.slice(0, 3),
    submittedBy: 'submitter',
    submitterName: 'Alice',
    result: {
      winner: 'team1',
      completed: true,
      sets: [{ setNumber: 1, gamesTeam1: 6, gamesTeam2: 2 }],
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /2 spillere/i);
  assert.equal(supabase.calls.length, 0);
  assert.equal(notifications.length, 0);
});
