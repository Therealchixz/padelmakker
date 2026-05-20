import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeNotificationRecipientIds } from '../../src/lib/notificationRecipients.js';

const notificationsSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../src/lib/notifications.js'),
  'utf8',
);

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

test('notification RPC always passes entity args to avoid Postgres overload ambiguity', () => {
  assert.match(notificationsSrc, /p_entity_type: entityType/);
  assert.match(notificationsSrc, /p_entity_id: entityId/);
  assert.doesNotMatch(notificationsSrc, /if \(!entityType \|\| !entityId\) return \{\}/);
});

test('normalizeNotificationRecipientIds enforces max batch size', () => {
  const many = Array.from({ length: 60 }, (_, i) => `id-${i}`);
  const ids = normalizeNotificationRecipientIds(many);
  assert.equal(ids.length, 50);
  assert.equal(ids[0], 'id-0');
  assert.equal(ids[49], 'id-49');
});
