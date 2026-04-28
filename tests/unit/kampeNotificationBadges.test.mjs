import test from 'node:test';
import assert from 'node:assert/strict';

import {
  groupUnreadNotificationsByMatchId,
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

test('shouldRefreshKampeUnreadForNotificationType routes chat and match notifications separately', () => {
  assert.equal(shouldRefreshKampeUnreadForNotificationType('match_chat'), 'chat');
  assert.equal(shouldRefreshKampeUnreadForNotificationType('result_submitted'), 'match');
  assert.equal(shouldRefreshKampeUnreadForNotificationType('match_cancelled'), 'match');
  assert.equal(shouldRefreshKampeUnreadForNotificationType('system'), null);
  assert.equal(shouldRefreshKampeUnreadForNotificationType(null), null);
});
