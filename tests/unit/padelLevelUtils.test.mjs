import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('padelLevelUtils maps niveau 1 and 7 to expected ELO band', () => {
  const src = readFileSync(join(root, 'src/lib/padelLevelUtils.js'), 'utf8');
  assert.match(src, /levelToElo/);
  assert.match(src, /eloToLevel/);
  assert.match(src, /matchPassesLevelFilter/);
  assert.match(src, /profilePassesLevelFilter/);
});

test('match filter UI uses niveau not ELO window', () => {
  // Siden 24. sep. 2026: kampe for mit niveau, eller selvvalgt fra-til.
  const page = readFileSync(join(root, 'src/dashboard/MatchSearchFilterPage.jsx'), 'utf8');
  assert.match(page, /<LevelRangeSlider/);
  assert.match(page, /Kampe for mit niveau/);
  assert.match(page, /Dit niveau er/);
  assert.doesNotMatch(page, /ELO-vindue/);
  assert.match(page, /Vælg hvilke kampe du vil have besked om/);
});

test('match filter core stores myLevel and levelWindow', () => {
  const core = readFileSync(join(root, 'src/lib/matchSearchFilterCore.js'), 'utf8');
  assert.match(core, /MATCH_FILTER_PREFS_VERSION = 2/);
  assert.match(core, /myLevel/);
  assert.match(core, /levelWindow/);
  assert.match(core, /matchPassesLevelFilter/);
});

test('padelLevelUtils exports spaced ELO and niveau range labels', () => {
  const src = readFileSync(join(root, 'src/lib/padelLevelUtils.js'), 'utf8');
  assert.match(src, /export function formatPlaytomicLevelRange/);
  assert.match(src, /export function formatEloRange/);
  assert.match(src, /export function formatMatchLevelRangeLabel/);
  assert.match(src, /\$\{formatPlaytomicLevel\(min\)\} – \$\{formatPlaytomicLevel\(max\)\}/);
  assert.match(src, /\$\{lo\} – \$\{hi\} ELO/);
  assert.match(src, /export function formatMatchLevelRangeParts/);
  assert.match(src, /Niveau \$\{formatPlaytomicLevelRange/);
});

test('SQL notify_match_watchers uses niveau in notification body', () => {
  const sql = readFileSync(join(root, 'supabase/sql/match_filter_niveau.sql'), 'utf8');
  assert.match(sql, /Niveau ~%s/);
  assert.match(sql, /match_filter_prefs_level/);
  assert.doesNotMatch(sql, /v_watcher_elo NOT BETWEEN/);
});
