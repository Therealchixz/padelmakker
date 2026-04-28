import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canConfirmPadelMatchResult,
  confirmPadelMatchResult,
  rejectPadelMatchResult,
} from '../../src/lib/resolvePadelMatchResult.js';

const resultRow = {
  id: 'result-1',
  match_id: 'match-1',
  submitted_by: 'submitter',
  set1_team1: 6,
  set1_team2: 2,
  set2_team1: 2,
  set2_team2: 6,
  set3_team1: 6,
  set3_team2: 7,
  set3_tb1: 5,
  set3_tb2: 7,
};

const players = [
  { user_id: 'submitter', team: 1 },
  { user_id: 'partner', team: 1 },
  { user_id: 'confirmer', team: 2 },
  { user_id: 'opponent', team: 2 },
];

function createSupabaseDecisionMock({ admins = [] } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      from(table) {
        return {
          update(payload) {
            calls.push({ table, action: 'update', payload });
            return {
              async eq(column, value) {
                calls.push({ table, action: 'update_eq', column, value });
                return { error: null };
              },
            };
          },
          delete() {
            calls.push({ table, action: 'delete' });
            return {
              async eq(column, value) {
                calls.push({ table, action: 'delete_eq', column, value });
                return { error: null };
              },
            };
          },
          select(columns) {
            calls.push({ table, action: 'select', columns });
            return {
              eq(column, value) {
                calls.push({ table, action: 'select_eq', column, value });
                return {
                  async neq(neqColumn, neqValue) {
                    calls.push({ table, action: 'select_neq', column: neqColumn, value: neqValue });
                    return { data: admins, error: null };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test('canConfirmPadelMatchResult only allows the opposing team or admin to confirm', () => {
  assert.deepEqual(canConfirmPadelMatchResult({
    result: resultRow,
    players,
    confirmedBy: 'confirmer',
    isAdmin: false,
  }), { ok: true });

  assert.deepEqual(canConfirmPadelMatchResult({
    result: resultRow,
    players,
    confirmedBy: 'partner',
    isAdmin: false,
  }), {
    ok: false,
    reason: 'Resultatet skal bekræftes af en spiller fra modstanderholdet.',
  });

  assert.deepEqual(canConfirmPadelMatchResult({
    result: resultRow,
    players,
    confirmedBy: 'partner',
    isAdmin: true,
  }), { ok: true });
});

test('canConfirmPadelMatchResult lets a player confirm a neutral admin-submitted result', () => {
  assert.deepEqual(canConfirmPadelMatchResult({
    result: { ...resultRow, submitted_by: 'admin-user' },
    players,
    confirmedBy: 'partner',
    isAdmin: false,
  }), { ok: true });
});

test('confirmPadelMatchResult rejects same-team confirmation before touching the database', async () => {
  const supabase = createSupabaseDecisionMock();
  const notifications = [];
  const eloCalls = [];

  const outcome = await confirmPadelMatchResult({
    supabaseClient: supabase.client,
    calculateAndApplyEloFn: async (...args) => {
      eloCalls.push(args);
      return { success: true, data: { players_updated: 4 } };
    },
    createNotificationFn: async (...args) => notifications.push(args),
    matchId: 'match-1',
    result: resultRow,
    players,
    confirmedBy: 'partner',
    isAdmin: false,
    showToast: () => {},
  });

  assert.deepEqual(outcome, {
    ok: false,
    reason: 'Resultatet skal bekræftes af en spiller fra modstanderholdet.',
  });
  assert.deepEqual(supabase.calls, []);
  assert.deepEqual(eloCalls, []);
  assert.deepEqual(notifications, []);
});

test('confirmPadelMatchResult confirms result, applies ELO and notifies all players with tiebreak score', async () => {
  const supabase = createSupabaseDecisionMock();
  const notifications = [];
  const eloCalls = [];

  const outcome = await confirmPadelMatchResult({
    supabaseClient: supabase.client,
    calculateAndApplyEloFn: async (...args) => {
      eloCalls.push(args);
      return { success: true, data: { players_updated: 4 } };
    },
    createNotificationFn: async (...args) => {
      notifications.push(args);
      return null;
    },
    matchId: 'match-1',
    result: resultRow,
    players,
    confirmedBy: 'confirmer',
    showToast: () => {},
  });

  assert.deepEqual(outcome, {
    ok: true,
    eloApplied: true,
    scoreDisplay: '6-2, 2-6, 6-7 (TB 5-7)',
    playersUpdated: 4,
  });
  assert.deepEqual(supabase.calls.slice(0, 2), [
    { table: 'match_results', action: 'update', payload: { confirmed: true, confirmed_by: 'confirmer' } },
    { table: 'match_results', action: 'update_eq', column: 'id', value: 'result-1' },
  ]);
  assert.equal(eloCalls[0][0], 'match-1');
  assert.equal(typeof eloCalls[0][1], 'function');
  assert.deepEqual(eloCalls[0][2], { matchResultId: 'result-1' });
  assert.deepEqual(notifications.map((n) => n[0]), ['submitter', 'partner', 'confirmer', 'opponent']);
  assert.equal(notifications.every((n) => n[1] === 'result_confirmed'), true);
  assert.equal(notifications.every((n) => String(n[3]).includes('6-7 (TB 5-7)')), true);
});

test('confirmPadelMatchResult does not notify when ELO application fails', async () => {
  const supabase = createSupabaseDecisionMock();
  const notifications = [];

  const outcome = await confirmPadelMatchResult({
    supabaseClient: supabase.client,
    calculateAndApplyEloFn: async () => ({ success: false, error: 'RPC failed' }),
    createNotificationFn: async (...args) => notifications.push(args),
    matchId: 'match-1',
    result: resultRow,
    players,
    confirmedBy: 'confirmer',
    showToast: () => {},
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.eloApplied, false);
  assert.equal(notifications.length, 0);
});

test('rejectPadelMatchResult deletes result and notifies submitter plus admins', async () => {
  const supabase = createSupabaseDecisionMock({
    admins: [{ id: 'admin-1' }, { id: 'admin-2' }],
  });
  const notifications = [];

  const outcome = await rejectPadelMatchResult({
    supabaseClient: supabase.client,
    createNotificationFn: async (...args) => {
      notifications.push(args);
      return null;
    },
    matchId: 'match-1',
    result: resultRow,
    rejectedBy: 'confirmer',
    rejecterName: 'Bo',
  });

  assert.deepEqual(outcome, { ok: true, adminsNotified: 2, submitterNotified: true });
  assert.deepEqual(supabase.calls.slice(0, 2), [
    { table: 'match_results', action: 'delete' },
    { table: 'match_results', action: 'delete_eq', column: 'id', value: 'result-1' },
  ]);
  assert.deepEqual(notifications.map((n) => n[0]), ['submitter', 'admin-1', 'admin-2']);
  assert.equal(notifications.every((n) => n[1] === 'result_submitted'), true);
  assert.equal(notifications.every((n) => String(n[3]).includes('afvist')), true);
});
