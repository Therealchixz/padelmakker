/**
 * "Jeg vil spille" opretter en åben kamp (ejerens beslutning 24. sep. 2026).
 * Puljen gav ingen kampe: fem tilmeldinger fra én konto på en måned.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuickMatchRow, QUICK_MATCH_MAX_WINDOW_MINUTES } from '../../src/lib/quickMatchRow.js';
import { parseMatchLevelRange } from '../../src/lib/matchLevelRange.js';
import { eloRangeToLevelRange } from '../../src/lib/padelLevelUtils.js';

test('rækken er en åben, gratis kamp uden bane med niveau ±0,5 om opretteren', () => {
  const row = buildQuickMatchRow({ user: { id: 'u1', level: 3.2, elo_rating: 927 }, date: '2026-09-25', start: '18:00', end: '21:00' });
  assert.equal(row.creator_id, 'u1');
  assert.equal(row.status, 'open');
  assert.equal(row.match_type, 'open');
  assert.equal(row.max_players, 4);
  assert.equal(row.court_id, null);
  assert.equal(row.price_per_person, 0);
  assert.equal(row.payment_method, 'free');
  assert.equal(row.time, '18:00');
  assert.equal(row.time_end, '21:00');
  assert.match(row.level_range, /\|booked:no$/);
  const r = parseMatchLevelRange(row.level_range);
  assert.deepEqual(eloRangeToLevelRange(r.min, r.max), { min: 2.7, max: 3.7 });
  assert.match(row.description, /18:00–21:00/);
});

test('et tidsrum må højst være 3 timer', () => {
  assert.equal(QUICK_MATCH_MAX_WINDOW_MINUTES, 180);
});

test('panelet opretter kampen, giver besked og viser overlappende kampe først', () => {
  const panel = readFileSync('src/components/PlayIntentPanel.jsx', 'utf8');
  assert.match(panel, /createQuickMatch\(/);
  assert.doesNotMatch(panel, /createPlayIntents\(/);
  assert.match(panel, /skipOverlapCheck/);
  assert.match(panel, /buildKampe2v2DetailPath\(res\.matchId\)/);
  const lib = readFileSync('src/lib/quickMatch.js', 'utf8');
  assert.match(lib, /notifyMatchWatchersForMatch\(created\.id\)/);
  assert.match(lib, /rpcJoinOpenMatch\(/);
  // Ingen kamp uden spillere, hvis opretteren ikke kan melde sig på.
  assert.match(lib, /from\('matches'\)\.delete\(\)\.eq\('id', created\.id\)/);
});
