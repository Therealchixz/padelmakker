import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countRelevantKampeUnreadNotifications,
  groupUnreadNotificationsByMatchId,
  groupRelevantUnreadNotificationsByMatchId,
  isKampeNotificationRelevantForStatus,
  removeUnreadForMatch,
  shouldRefreshKampeUnreadForNotificationType,
} from '../../src/lib/kampeNotificationBadges.js';

test('groupUnreadNotificationsByMatchId counts only rows with a match id', () => {
  const grouped = groupUnreadNotificationsByMatchId([
    { id: 1, match_id: 'match-1' },
    { id: 2, match_id: 'match-1' },
    { id: 3, match_id: 'match-2' },
    { id: 4, match_id: null },
    { id: 5 },
  ]);

  assert.deepEqual(grouped, {
    'match-1': 2,
    'match-2': 1,
  });
});

test('removeUnreadForMatch removes a match without mutating previous state', () => {
  const previous = { 'match-1': 2, 'match-2': 1 };
  const next = removeUnreadForMatch(previous, 'match-1');

  assert.deepEqual(next, { 'match-2': 1 });
  assert.deepEqual(previous, { 'match-1': 2, 'match-2': 1 });
  assert.equal(removeUnreadForMatch(previous, 'missing'), previous);
});

test('isKampeNotificationRelevantForStatus only keeps notifications for the current match phase', () => {
  assert.equal(isKampeNotificationRelevantForStatus('match_join', 'open'), true);
  assert.equal(isKampeNotificationRelevantForStatus('match_full', 'full'), true);
  assert.equal(isKampeNotificationRelevantForStatus('match_full', 'completed'), false);
  assert.equal(isKampeNotificationRelevantForStatus('result_submitted', 'in_progress'), true);
  assert.equal(isKampeNotificationRelevantForStatus('result_submitted', 'completed'), false);
  assert.equal(isKampeNotificationRelevantForStatus('result_confirmed', 'completed'), true);
  assert.equal(isKampeNotificationRelevantForStatus('match_chat', 'completed'), true);
});

test('groupRelevantUnreadNotificationsByMatchId drops stale notifications after a match moves phase', () => {
  const rows = [
    { id: 1, match_id: 'match-1', type: 'match_join' },
    { id: 2, match_id: 'match-1', type: 'match_full' },
    { id: 3, match_id: 'match-1', type: 'result_submitted' },
    { id: 4, match_id: 'match-1', type: 'result_confirmed' },
    { id: 5, match_id: 'match-2', type: 'match_full' },
    { id: 6, match_id: 'match-2', type: 'result_confirmed' },
  ];
  const statusByMatchId = {
    'match-1': 'completed',
    'match-2': 'full',
  };

  assert.deepEqual(groupRelevantUnreadNotificationsByMatchId(rows, statusByMatchId), {
    'match-1': 1,
    'match-2': 1,
  });
});

test('countRelevantKampeUnreadNotifications counts only relevant unread rows', () => {
  const rows = [
    { match_id: 'match-1', type: 'match_join' },
    { match_id: 'match-1', type: 'result_confirmed' },
    { match_id: 'match-2', type: 'result_submitted' },
    { match_id: 'match-2', type: 'match_full' },
  ];

  assert.equal(countRelevantKampeUnreadNotifications(rows, {
    'match-1': 'completed',
    'match-2': 'in_progress',
  }), 2);
});

test('shouldRefreshKampeUnreadForNotificationType routes chat and match notifications separately', () => {
  assert.equal(shouldRefreshKampeUnreadForNotificationType('match_chat'), 'chat');
  assert.equal(shouldRefreshKampeUnreadForNotificationType('result_submitted'), 'match');
  assert.equal(shouldRefreshKampeUnreadForNotificationType('match_cancelled'), 'match');
  assert.equal(shouldRefreshKampeUnreadForNotificationType('system'), null);
  assert.equal(shouldRefreshKampeUnreadForNotificationType(null), null);
});
