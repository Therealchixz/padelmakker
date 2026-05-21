import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('makker filter SQL adds prefs and notify_makker_watchers', () => {
  const sql = readFileSync(join(root, 'supabase/sql/makker_search_filter.sql'), 'utf8');
  assert.match(sql, /makker_search_prefs/);
  assert.match(sql, /makker_watch_enabled/);
  assert.match(sql, /notify_makker_watchers/);
  assert.match(sql, /makker_suggestion/);
  assert.match(sql, /entity_type = 'profile'/);
});

test('makkerWatchUtils calls RPC and push type', () => {
  const client = readFileSync(join(root, 'src/lib/makkerWatchUtils.js'), 'utf8');
  assert.match(client, /notify_makker_watchers/);
  assert.match(client, /makker_suggestion/);
});

test('makker filter core matches seeking profiles by level', () => {
  const core = readFileSync(join(root, 'src/lib/makkerSearchFilterCore.js'), 'utf8');
  assert.match(core, /seekingProfileMatchesFilter/);
  assert.match(core, /profilePassesLevelFilter/);
  assert.match(core, /MAKKER_FILTER_PREFS_VERSION/);
});

test('notification policy routes makker_suggestion to opdagelse', () => {
  const policy = readFileSync(join(root, 'src/lib/notificationPolicy.js'), 'utf8');
  assert.match(policy, /makker_suggestion[\s\S]*channel:\s*["']opdagelse["']/);
});
