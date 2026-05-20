import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KAMPE_CHAT_NOTIFICATION_TYPE,
  KAMPE_ENTITY_NOTIFICATION_TYPES,
  KAMPE_NON_CHAT_NOTIFICATION_TYPES,
  KAMPE_NOTIFICATION_TYPES,
  isKampeEntityNotificationType,
  isKampeNotificationType,
} from '../../src/lib/kampeNotificationTypes.js';

test('Kampe notification types include padel, entity events, and chat', () => {
  assert.equal(KAMPE_CHAT_NOTIFICATION_TYPE, 'match_chat');
  assert.ok(KAMPE_ENTITY_NOTIFICATION_TYPES.includes('americano_invite'));
  assert.ok(KAMPE_ENTITY_NOTIFICATION_TYPES.includes('americano_full'));
  assert.ok(KAMPE_ENTITY_NOTIFICATION_TYPES.includes('team_invite'));
  assert.ok(KAMPE_NON_CHAT_NOTIFICATION_TYPES.includes('match_join'));

  const all = [...KAMPE_NOTIFICATION_TYPES];
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.includes('match_chat'));
  assert.ok(all.includes('league_started'));
});

test('isKampeNotificationType and isKampeEntityNotificationType', () => {
  assert.equal(isKampeNotificationType('match_chat'), true);
  assert.equal(isKampeNotificationType('americano_started'), true);
  assert.equal(isKampeNotificationType('system'), false);
  assert.equal(isKampeEntityNotificationType('team_invite'), true);
  assert.equal(isKampeEntityNotificationType('match_join'), false);
  assert.equal(isKampeEntityNotificationType('americano_invite'), true);
});
