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

test('makker filter core matches seeking profiles by level and extras', () => {
  const core = readFileSync(join(root, 'src/lib/makkerSearchFilterCore.js'), 'utf8');
  assert.match(core, /seekingProfileMatchesFilter/);
  assert.match(core, /subjectPassesMakkerLevelFilter/);
  assert.match(core, /MAKKER_FILTER_PREFS_VERSION = 2/);
  assert.match(core, /courtSideMatchesMakkerFilter/);
});

test('makker filter v2 SQL helpers and notify', () => {
  const sql = readFileSync(join(root, 'supabase/sql/makker_filter_v2.sql'), 'utf8');
  assert.match(sql, /makker_filter_court_side_ok/);
  assert.match(sql, /makker_filter_intent_ok/);
  assert.match(sql, /makker_filter_level_bounds/);
});

test('notification policy routes makker_suggestion to opdagelse', () => {
  const policy = readFileSync(join(root, 'src/lib/notificationPolicy.js'), 'utf8');
  assert.match(policy, /makker_suggestion[\s\S]*channel:\s*["']opdagelse["']/);
});
