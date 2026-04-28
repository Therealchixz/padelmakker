import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMatchCardState,
  matchStatusLabel,
} from '../../src/lib/matchCardState.js';

const teamStats = {
  t1: [{ user_id: 'me' }, { user_id: 'p2' }],
  t2: [{ user_id: 'p3' }, { user_id: 'p4' }],
  t1Avg: 1010,
  t2Avg: 990,
  playerEloByUserId: {},
};

test('matchStatusLabel describes open matches by available spots', () => {
  assert.deepEqual(matchStatusLabel('open', 2), { text: '2 ledige', tone: 'accent' });
  assert.deepEqual(matchStatusLabel('open', 1), { text: '1 ledig', tone: 'accent' });
  assert.deepEqual(matchStatusLabel('open', 0), { text: 'Fuld', tone: 'warm' });
  assert.deepEqual(matchStatusLabel('in_progress', 0), { text: 'I gang', tone: 'warm' });
  assert.deepEqual(matchStatusLabel('completed', 0), { text: 'Afsluttet', tone: 'neutral' });
});

test('buildMatchCardState derives membership, teams, requests and unread state', () => {
  const state = buildMatchCardState({
    match: { id: 'match-1', creator_id: 'creator', max_players: 4, match_type: 'closed' },
    players: [...teamStats.t1, ...teamStats.t2],
    teamStats,
    matchResult: { id: 'result-1', confirmed: false },
    joined: true,
    currentUserId: 'me',
    busyId: 'other-match',
    status: 'in_progress',
    joinRequests: [
      { user_id: 'me', status: 'approved' },
      { user_id: 'other', status: 'pending' },
    ],
    isAdmin: true,
    adminActionsOpen: false,
    chatOpen: true,
    chatMessages: [{ id: 'msg-1' }],
    chatDraft: 'hej',
    chatLoading: false,
    chatSending: true,
    chatError: '',
    unreadChatCount: 3,
    unreadMatchCount: 1,
  });

  assert.equal(state.left, 0);
  assert.equal(state.isFull, true);
  assert.equal(state.isPlayerInMatch, true);
  assert.equal(state.myTeam, 1);
  assert.equal(state.isClosed, true);
  assert.equal(state.hasAdminActions, true);
  assert.equal(state.canUseMatchChat, true);
  assert.equal(state.canWriteMatchChat, true);
  assert.equal(state.chatSending, true);
  assert.equal(state.unreadChatCount, 3);
  assert.equal(state.unreadMatchCount, 1);
  assert.deepEqual(state.pendingRequests, [{ user_id: 'other', status: 'pending' }]);
  assert.deepEqual(state.statusLabel, { text: 'I gang', tone: 'warm' });
});

test('buildMatchCardState keeps non-participants read-only for match chat', () => {
  const state = buildMatchCardState({
    match: { id: 'match-2', creator_id: 'creator', max_players: 4, match_type: 'open' },
    players: [{ user_id: 'p1', team: 1 }],
    teamStats: { t1: [{ user_id: 'p1' }], t2: [], t1Avg: 1000, t2Avg: null, playerEloByUserId: {} },
    matchResult: null,
    joined: false,
    currentUserId: 'viewer',
    busyId: 'match-2',
    status: 'open',
    joinRequests: [],
    isAdmin: false,
  });

  assert.equal(state.left, 3);
  assert.equal(state.busy, true);
  assert.equal(state.isCreator, false);
  assert.equal(state.canUseMatchChat, false);
  assert.equal(state.canWriteMatchChat, false);
  assert.deepEqual(state.statusLabel, { text: '3 ledige', tone: 'accent' });
});
