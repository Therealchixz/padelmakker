/**
 * Ejeren 27. sep. 2026: "Jeg har ikke mulighed for at fjerne/slette liga
 * hverken som opretter eller admin?" + "0 hold max" og "0/0" uden holdgrænse.
 *
 * Afprøvet mod databasen i en tilbagerullet transaktion: ejeren (opretter og
 * admin) kunne sende league_cancelled til et tilmeldt hold og slette ligaen;
 * holdene forsvandt med (ON DELETE CASCADE).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('"Slet liga" findes i admin-værktøjerne (tilmelding og i gang)', () => {
  const detail = read('src/dashboard/LigaSelectedDetail.jsx');
  assert.match(detail, /function DeleteLeagueButton/);
  assert.match(detail, /Slet liga/);
  assert.equal((detail.match(/<DeleteLeagueButton /g) || []).length, 2);
});

test('opretteren kan slette under tilmelding, admin altid; holdene får besked først', () => {
  const tab = read('src/dashboard/LigaTab.jsx');
  assert.match(tab, /onDeleteLeague=\{isAdmin \|\| \(isCreator && selectedLeague\.status === 'registration'\)/);
  const fn = tab.slice(tab.indexOf('const deleteLeague = async'), tab.indexOf('const toggleManageTools'));
  assert.ok(fn.indexOf('notifyLeagueCancelled') < fn.indexOf(".from('leagues').delete()"), 'besked før sletning');
  assert.match(fn, /danger: true/);
});

test('league_cancelled er registreret i både app og push', () => {
  for (const f of ['src/lib/notificationPolicy.js', 'supabase/functions/send-push/index.ts']) {
    const src = read(f);
    const block = src.slice(src.indexOf('league_cancelled: {'), src.indexOf('league_cancelled: {') + 200);
    assert.match(block, /channel: "liga"/, f);
    assert.match(block, /sendPush: true/, f);
  }
  assert.match(read('src/lib/kampeNotificationTypes.js'), /'league_cancelled'/);
});

test('uden holdgrænse: aldrig "Fuld", og ingen "0 hold max" / "0/0"', () => {
  // ligaDisplayUtils importerer uden .js og kan ikke køres fra node; tjek logikken i kilden.
  assert.match(read('src/lib/ligaDisplayUtils.js'), /const max = Number\(league\?\.max_teams\) > 0 \?/);
  assert.doesNotMatch(read('src/dashboard/LigaDetailSheet.jsx'), /league\.max_teams \|\| teamCount\} hold max/);
  assert.match(read('src/dashboard/LigaListCard.jsx'), /Frist \{shortDateLabel\(league\.registration_deadline \|\| league\.end_date\)\}/);
  assert.match(read('src/dashboard/LigaSelectedDetail.jsx'), /\{league\.max_teams \? \(\n\s*<div className="pm-americano-v2-list-progress-row"/);
});
