import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const kampe = readFileSync('src/dashboard/KampeTab.jsx', 'utf8');
const watch = readFileSync('supabase/sql/play_intent_open_match_notify.sql', 'utf8');
const reactivation = readFileSync('supabase/sql/reactivation_nudges.sql', 'utf8');

test('Kampe beholder listen under genindlæsning i stedet for at flikke', () => {
  assert.match(kampe, /hasMatchListRef/);
  assert.match(kampe, /loadingMatches && matches\.length === 0/);
  assert.match(kampe, /!loadingMatches \|\| matches\.length > 0/);
});

test('afmelding og anmodnings-svar er ikke kamp-aflyst eller invitation', () => {
  assert.match(kampe, /'match_join',\s*\n\s*'Spiller afmeldt/);
  assert.match(kampe, /createNotification\(reqUserId, "match_join", "Anmodning godkendt/);
  assert.match(kampe, /createNotification\(reqUserId, "match_join", "Anmodning afvist"/);
  assert.doesNotMatch(kampe, /createNotification\(\s*match\.creator_id,\s*'match_cancelled',\s*'Spiller afmeldt/);
});

test('play-intent discovery ignorerer hensigter der allerede er udløbet i dag', () => {
  assert.match(watch, /Dagens hensigt er udløbet/);
  assert.match(watch, /i\.end_time > \(timezone\('Europe\/Copenhagen', now\(\)\)\)::time/);
});

test('reactivation tæller kun åbne kampe der stadig ligger i fremtiden', () => {
  assert.match(reactivation, /m\.time_end ~ '\^\\d\{1,2\}:\\d\{2\}'/);
  assert.match(reactivation, /\) >= now\(\)/);
});

test('Kampe genindlæser listen live og når appen kommer i forgrunden', () => {
  assert.match(kampe, /kampe-list-\$\{user\.id\}/);
  assert.match(kampe, /table: "match_players"/);
  assert.match(kampe, /table: "match_join_requests"/);
  assert.match(kampe, /type === "match_join"/);
  assert.match(kampe, /visibilitychange", onVis/);
});

test('åbne Americano/Mexicano skjuler passerede datoer', () => {
  const tab = readFileSync('src/features/americano/AmericanoTab.tsx', 'utf8');
  const display = readFileSync('src/lib/matchDisplayUtils.js', 'utf8');
  assert.match(display, /export function copenhagenTodayYmd/);
  assert.match(tab, /copenhagenTodayYmd/);
  assert.match(tab, /\.gte\('tournament_date', todayCph\)/);
  assert.match(tab, /t\.status === 'registration' && String\(t\.tournament_date \|\| ''\) >= todayCph/);
});

test('expire_stale_play_intents kan ikke kaldes af anon', () => {
  const pool = readFileSync('supabase/sql/play_intent_pool.sql', 'utf8');
  assert.match(pool, /REVOKE ALL ON FUNCTION public\.expire_stale_play_intents\(\) FROM PUBLIC, anon;/);
});
