import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('match watch RPC and client helper exist', () => {
  const sql = readFileSync(join(root, 'supabase/migrations/20260522120000_match_watch_discovery.sql'), 'utf8');
  assert.match(sql, /match_watch_enabled/);
  assert.match(sql, /notify_match_watchers/);
  assert.match(sql, /discovery_notifications_today_count/);
  assert.match(readFileSync(join(root, 'supabase/sql/discovery_notification_limits.sql'), 'utf8'), /p_types text\[\]/);

  const client = readFileSync(join(root, 'src/lib/matchWatchUtils.js'), 'utf8');
  assert.match(client, /notify_match_watchers/);
  assert.match(client, /match_watch_match/);
});

test('notification policy uses opdagelse channel for match watch', () => {
  const policy = readFileSync(join(root, 'src/lib/notificationPolicy.js'), 'utf8');
  assert.match(policy, /match_watch_match[\s\S]*channel:\s*["']opdagelse["']/);
  const prefs = readFileSync(join(root, 'src/lib/notificationPreferences.js'), 'utf8');
  assert.match(prefs, /opdagelse/);
});
