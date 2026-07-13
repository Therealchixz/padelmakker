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

test('kamp-filter lives on dedicated page instead of ProfilTab toggles', () => {
  const filterPage = readFileSync(join(root, 'src/dashboard/MatchSearchFilterPage.jsx'), 'utf8');
  const shortcut = readFileSync(join(root, 'src/components/SeekingFilterShortcutCard.jsx'), 'utf8');
  const profilTab = readFileSync(join(root, 'src/dashboard/ProfilTab.jsx'), 'utf8');
  assert.match(filterPage, /Mit kamp-filter/);
  assert.match(shortcut, /Mit kamp-filter/);
  assert.doesNotMatch(filterPage, /🔔 Kamp-watch/);
  assert.doesNotMatch(filterPage, /⚡ Søger kamp nu/);
  assert.doesNotMatch(profilTab, /Mit kamp-filter/);
  assert.doesNotMatch(profilTab, /MatchFilterProfileCard/);
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
