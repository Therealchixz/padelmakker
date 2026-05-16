import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNotificationRecipientIds } from '../../src/lib/notificationRecipients.js';

test('normalizeNotificationRecipientIds dedupes and caps recipients', () => {
  const ids = normalizeNotificationRecipientIds([
    'a',
    'b',
    'a',
    '',
    null,
    'c',
  ]);
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

test('normalizeNotificationRecipientIds enforces max batch size', () => {
  const many = Array.from({ length: 60 }, (_, i) => `id-${i}`);
  const ids = normalizeNotificationRecipientIds(many);
  assert.equal(ids.length, 50);
  assert.equal(ids[0], 'id-0');
  assert.equal(ids[49], 'id-49');
});
