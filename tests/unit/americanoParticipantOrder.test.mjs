import test from 'node:test';
import assert from 'node:assert/strict';

import {
  orderParticipantIdsForSchedule,
  shuffleParticipantIdsForSchedule,
  sortParticipantIdsByJoinOrder,
} from '../../src/lib/americanoParticipantOrder.ts';
import { buildAmericanoRoundRobinMatchRows } from '../../src/lib/americanoRoundRobinSchedule.ts';

const TOURNAMENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test('shuffleParticipantIdsForSchedule is deterministic for same tournament and roster', () => {
  const ids = ['p-a', 'p-b', 'p-c', 'p-d', 'p-e'];
  const a = shuffleParticipantIdsForSchedule(ids, TOURNAMENT_ID);
  const b = shuffleParticipantIdsForSchedule(ids, TOURNAMENT_ID);
  assert.deepEqual(a, b);
});

test('shuffleParticipantIdsForSchedule permutes all ids', () => {
  const ids = ['p-a', 'p-b', 'p-c', 'p-d', 'p-e'];
  const shuffled = shuffleParticipantIdsForSchedule(ids, TOURNAMENT_ID);
  assert.deepEqual([...shuffled].sort(), [...ids].sort());
});

test('schedule order does not follow join order for typical tournament seed', () => {
  const participants = [
    { id: 'first-join', joined_at: '2026-01-01T10:00:00Z' },
    { id: 'second', joined_at: '2026-01-01T10:01:00Z' },
    { id: 'third', joined_at: '2026-01-01T10:02:00Z' },
    { id: 'fourth', joined_at: '2026-01-01T10:03:00Z' },
    { id: 'fifth', joined_at: '2026-01-01T10:04:00Z' },
  ];
  const joinOrder = sortParticipantIdsByJoinOrder(participants);
  const scheduleOrder = orderParticipantIdsForSchedule(joinOrder, TOURNAMENT_ID);
  assert.notDeepEqual(scheduleOrder, joinOrder);
});

test('buildAmericanoRoundRobinMatchRows still fair for shuffled 5-player order', () => {
  const joinOrder = ['j0', 'j1', 'j2', 'j3', 'j4'];
  const scheduleOrder = orderParticipantIdsForSchedule(joinOrder, TOURNAMENT_ID);
  const rows = buildAmericanoRoundRobinMatchRows('t1', scheduleOrder, 1, 1);
  assert.equal(rows.length, 5);

  const playCount = Object.fromEntries(scheduleOrder.map((id) => [id, 0]));
  for (const m of rows) {
    for (const pid of [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]) {
      playCount[pid] += 1;
    }
  }
  assert.deepEqual(Object.values(playCount), [4, 4, 4, 4, 4]);
});

test('different tournament ids can yield different schedule orders', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const orders = new Set(
    [
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
    ].map((tid) => JSON.stringify(shuffleParticipantIdsForSchedule(ids, tid))),
  );
  assert.ok(orders.size >= 2, 'forventer variation mellem turneringer');
});
