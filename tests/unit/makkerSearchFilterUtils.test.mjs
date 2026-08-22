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

test('dispatch-push can send audible makker-match to lock screen without a user JWT', () => {
  const src = readFileSync(join(root, 'supabase/functions/dispatch-push/index.ts'), 'utf8');
  assert.match(src, /reminder_cron_secret/);
  assert.match(src, /silent: false/);
  assert.match(src, /urgency: "high"/);
  assert.match(src, /makker_suggestion/);
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
  assert.match(core, /profileFitsMakkerSearchFrame/);
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

test('makkere-søg rangerer alle spillere og bruger ramme uden region-cut', () => {
  const core = readFileSync(join(root, 'src/lib/makkerSearchFilterCore.js'), 'utf8');
  const tab = readFileSync(join(root, 'src/dashboard/MakkereTab.jsx'), 'utf8');
  const mm = readFileSync(join(root, 'src/lib/matchmakingUtils.js'), 'utf8');
  assert.match(core, /profileFitsMakkerSearchFrame/);
  assert.match(mm, /export function rankMakkerSearchResults/);
  assert.match(tab, /rankMakkerSearchResults/);
  assert.match(tab, /profileFitsMakkerSearchFrame/);
  assert.match(tab, /Søg makker/);
  assert.doesNotMatch(tab, /profileMatchesMakkerFilter/);
});

test('to der begge søger makker får besked begge veje', () => {
  const sql = readFileSync(join(root, 'supabase/sql/seeking_makker_match.sql'), 'utf8');
  assert.match(sql, /makker_feed_is_active/);
  assert.match(sql, /I matcher som makkere/);
  assert.match(sql, /v_matches/);
  assert.match(sql, /p_subject_user_id, 'makker_suggestion'/);
  const client = readFileSync(join(root, 'src/lib/makkerWatchUtils.js'), 'utf8');
  assert.match(client, /makkerMatchToast/);
  assert.match(client, /match_recipient_ids/);
  assert.match(client, /sendPushNotificationsForUsers\(\s*\[subjectUserId\]/s);
});
