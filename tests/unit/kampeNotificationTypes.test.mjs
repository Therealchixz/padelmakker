import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KAMPE_CHAT_NOTIFICATION_TYPE,
  KAMPE_NON_CHAT_NOTIFICATION_TYPES,
  KAMPE_NOTIFICATION_TYPES,
  isKampeNotificationType,
} from '../../src/lib/kampeNotificationTypes.js';

test('Kampe badge notification types include every match-related type exactly once', () => {
  assert.equal(KAMPE_CHAT_NOTIFICATION_TYPE, 'match_chat');
  assert.deepEqual(KAMPE_NON_CHAT_NOTIFICATION_TYPES, [
    'match_join',
    'match_invite',
    'match_full',
    'match_cancelled',
    'result_submitted',
    'result_confirmed',
    'seeking_player',
  ]);

  assert.deepEqual(KAMPE_NOTIFICATION_TYPES, [
    'match_chat',
    'match_join',
    'match_invite',
    'match_full',
    'match_cancelled',
    'result_submitted',
    'result_confirmed',
    'seeking_player',
  ]);
  assert.equal(new Set(KAMPE_NOTIFICATION_TYPES).size, KAMPE_NOTIFICATION_TYPES.length);
});

test('isKampeNotificationType only accepts match-related notification types', () => {
  assert.equal(isKampeNotificationType('match_chat'), true);
  assert.equal(isKampeNotificationType('result_submitted'), true);
  assert.equal(isKampeNotificationType('system'), false);
  assert.equal(isKampeNotificationType(null), false);
});
