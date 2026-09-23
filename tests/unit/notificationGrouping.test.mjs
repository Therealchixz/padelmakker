/**
 * Punkt 7: notifikationer.
 *  - Én "tilmeldt"-besked pr. kamp, der opdaterer sig selv ("2 spillere har
 *    tilmeldt sig din kamp") i stedet for én ny besked pr. spiller.
 *  - Alder i hele ord ("3 uger", ikke "3u").
 *  - Kampforslag, hvis frist er udløbet, står ikke som ulæste opgaver.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { formatNotificationAge, isExpiredActionNotification, settleExpiredNotifications } from '../../src/lib/notificationAge.js';
import { matchJoinPushContent } from '../../src/lib/matchJoinNotice.js';
import { resolveNotificationClickTarget } from '../../src/lib/notificationClickTarget.js';

const NOW = Date.parse('2026-09-23T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test('alder skrives i hele ord', () => {
  assert.equal(formatNotificationAge(ago(10 * 1000), NOW), 'nu');
  assert.equal(formatNotificationAge(ago(5 * MIN), NOW), '5 min');
  assert.equal(formatNotificationAge(ago(3 * HOUR), NOW), '3 t');
  assert.equal(formatNotificationAge(ago(DAY + HOUR), NOW), 'I går');
  assert.equal(formatNotificationAge(ago(5 * DAY), NOW), '5 dage');
  assert.equal(formatNotificationAge(ago(8 * DAY), NOW), '1 uge');
  assert.equal(formatNotificationAge(ago(22 * DAY), NOW), '3 uger');
  assert.equal(formatNotificationAge(ago(35 * DAY), NOW), '1 måned');
  assert.equal(formatNotificationAge(ago(70 * DAY), NOW), '2 måneder');
});

test('udløbne kampforslag: ingen knap og markeres læst', () => {
  const old = { id: 'a', type: 'match_proposal_reminder', read: false, created_at: ago(29 * DAY), entity_id: 'p1' };
  const fresh = { id: 'b', type: 'match_proposal', read: false, created_at: ago(2 * HOUR), entity_id: 'p2' };
  const other = { id: 'c', type: 'match_join', read: false, created_at: ago(29 * DAY), match_id: 'm1' };
  assert.equal(isExpiredActionNotification(old, NOW), true);
  assert.equal(isExpiredActionNotification(fresh, NOW), false);
  assert.equal(isExpiredActionNotification(other, NOW), false, 'kun forslag har en frist');

  assert.equal(resolveNotificationClickTarget(old, { now: NOW }), null);
  assert.equal(resolveNotificationClickTarget(fresh, { now: NOW })?.kind, 'proposal-popup');

  const { rows, expiredIds } = settleExpiredNotifications([old, fresh, other], NOW);
  assert.deepEqual(expiredIds, ['a']);
  assert.equal(rows[0].read, true);
  assert.equal(rows[1].read, false);
  assert.equal(rows[2].read, false);
});

test('push ved tilmelding bruger serverens samlede tekst', () => {
  assert.deepEqual(
    matchJoinPushContent({ notify: true, title: '2 spillere har tilmeldt sig din kamp', body: 'Mike og Anna · 1 plads tilbage' }, 'x'),
    { title: '2 spillere har tilmeldt sig din kamp', body: 'Mike og Anna · 1 plads tilbage' },
  );
  assert.equal(matchJoinPushContent({ notify: false }, 'x'), null, 'uændret besked → ingen ny push');
  assert.deepEqual(matchJoinPushContent(null, 'Mike har tilmeldt sig'), { title: 'Ny spiller tilmeldt!', body: 'Mike har tilmeldt sig' });
});

test('databasen samler tilmeldinger til én besked pr. kamp', async () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const file = (await readdir(dir)).filter((f) => f.endsWith('_match_join_notification_grouped.sql')).pop();
  assert.ok(file, 'migrationen findes');
  const sql = await readFile(new URL(file, dir), 'utf8');
  assert.match(sql, /RETURNS jsonb/);
  assert.match(sql, /spillere har tilmeldt sig din kamp/);
  assert.match(sql, /UPDATE public\.notifications\s+SET title = v_title/);
  assert.match(sql, /read = false,\s+created_at = now\(\)/);
  assert.match(sql, /GRANT ALL ON FUNCTION public\.notify_match_creator_on_join\(uuid, text, text\) TO authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.notify_match_creator_on_join\(uuid, text, text\) FROM PUBLIC, anon/);
});
