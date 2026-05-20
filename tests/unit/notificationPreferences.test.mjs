import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPushChannelEnabled,
  mergeNotificationPrefToggle,
  normalizeNotificationPrefs,
} from '../../src/lib/notificationPreferences.js';

test('normalizeNotificationPrefs defaults all channels on', () => {
  const p = normalizeNotificationPrefs(null);
  assert.equal(p.push.kampe, true);
  assert.equal(p.push.resultat, true);
});

test('isPushChannelEnabled respects toggles and admin channel', () => {
  const p = normalizeNotificationPrefs({ push: { kampe: false, system: true } });
  assert.equal(isPushChannelEnabled(p, 'kampe'), false);
  assert.equal(isPushChannelEnabled(p, 'admin'), true);
  assert.equal(isPushChannelEnabled(p, 'resultat'), true);
});

test('mergeNotificationPrefToggle updates one channel', () => {
  const next = mergeNotificationPrefToggle(normalizeNotificationPrefs(null), 'chat', false);
  assert.equal(next.push.chat, false);
  assert.equal(next.push.kampe, true);
});
