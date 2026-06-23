import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('match search filter SQL adds prefs column and updates notify_match_watchers', () => {
  const sql = readFileSync(join(root, 'supabase/sql/match_search_filter.sql'), 'utf8');
  assert.match(sql, /match_search_prefs jsonb/);
  assert.match(sql, /Ny kamp passer til dit filter/);
  assert.match(sql, /match_search_prefs->>'notify'/);
  assert.match(sql, /jsonb_array_elements_text/);
});

test('ProfilTab no longer embeds the kamp-filter (moved to Kampe og Find makker)', () => {
  // Filtrene blev bevidst flyttet ud af profilen (commit 79b7fdf); de ligger nu
  // under Kampe og Find makker. Profilen må derfor ikke længere have dem.
  const src = readFileSync(join(root, 'src/dashboard/ProfilTab.jsx'), 'utf8');
  assert.doesNotMatch(src, /Mit kamp-filter/);
  assert.doesNotMatch(src, /MatchFilterProfileCard/);
  assert.doesNotMatch(src, /🔔 Kamp-watch/);
  assert.doesNotMatch(src, /⚡ Søger kamp nu/);
});

test('Dashboard exposes kamp-filter route', () => {
  const src = readFileSync(join(root, 'src/dashboard/DashboardPage.jsx'), 'utf8');
  assert.match(src, /kamp-filter/);
  assert.match(src, /MatchSearchFilterPage/);
});

test('HomeTab shows matching open match count when filter active', () => {
  const src = readFileSync(join(root, 'src/dashboard/HomeTab.jsx'), 'utf8');
  assert.match(src, /countOpenMatchesMatchingFilter/);
  assert.match(src, /matcher dit filter/);
});

test('saveMatchSearchPrefs syncs legacy watch and seeking flags', () => {
  const src = readFileSync(join(root, 'src/lib/matchSearchFilterCore.js'), 'utf8');
  assert.match(src, /match_watch_enabled: notifyOn/);
  assert.match(src, /seeking_match: feedOn/);
  assert.match(src, /match_search_prefs/);
  assert.match(src, /levelWindow/);
});

test('seeking player prioritizes filter notify over legacy watch only', () => {
  const src = readFileSync(join(root, 'src/lib/seekingPlayerUtils.js'), 'utf8');
  assert.match(src, /matchSearchFilterCore/);
  assert.match(src, /filterPrefs\.notify/);
});
