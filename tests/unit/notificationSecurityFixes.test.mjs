import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveNotificationPushPolicy } from '../../src/lib/notificationPolicy.js';
import { notificationKampeTarget } from '../../src/lib/kampeFocusNavigation.js';
import {
  KAMPE_ENTITY_NOTIFICATION_TYPES,
  KAMPE_NOTIFICATION_TYPES,
} from '../../src/lib/kampeNotificationTypes.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readSrc(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

test('notification policy covers invite and admin push types', () => {
  for (const type of [
    'match_invite',
    'americano_invite',
    'seeking_player',
    'result_error_report',
    'user_report',
    'team_invite',
    'team_invite_accepted',
    'team_invite_declined',
  ]) {
    const policy = resolveNotificationPushPolicy(type);
    assert.equal(policy.type, type, `missing policy for ${type}`);
    assert.equal(typeof policy.sendPush, 'boolean');
    assert.equal(typeof policy.cooldownSeconds, 'number');
  }
});

test('americano_invite is a Kampe entity notification with push enabled', () => {
  assert.ok(KAMPE_ENTITY_NOTIFICATION_TYPES.includes('americano_invite'));
  assert.ok(KAMPE_NOTIFICATION_TYPES.includes('americano_invite'));
  const policy = resolveNotificationPushPolicy('americano_invite');
  assert.equal(policy.channel, 'invitation');
  assert.equal(policy.sendPush, true);
});

test('americano_invite notifications deep-link to Americano in Kampe', () => {
  const target = notificationKampeTarget({
    type: 'americano_invite',
    entity_type: 'americano',
    entity_id: 'tour-uuid-1',
    match_id: null,
  });
  assert.deepEqual(target, { format: 'americano', focusId: 'tour-uuid-1' });
});

test('notifications.js exports invalidateNotificationPrefsCache', () => {
  const src = readSrc('src/lib/notifications.js');
  assert.match(src, /export function invalidateNotificationPrefsCache/);
  assert.match(src, /prefsCache\.delete/);
});

test('InviteToMatchModal uses americano_invite with entity context', () => {
  const src = readSrc('src/dashboard/InviteToMatchModal.jsx');
  // Scoped til selve americano-notifikationskaldet, så en regression der
  // dropper entity-konteksten fra kaldet fanges (ikke bare et hel-fils-match).
  assert.match(
    src,
    /createNotification\(\s*invitee\.id,\s*'americano_invite'[\s\S]*?\{\s*entityType:\s*'americano',\s*entityId:\s*item\.id\s*\}/,
  );
});

test('InviteToMatchModal still uses match_invite for 2v2 matches', () => {
  const src = readSrc('src/dashboard/InviteToMatchModal.jsx');
  // Scoped til selve match-notifikationskaldet: match_invite skal sendes med kampens id.
  assert.match(
    src,
    /createNotification\(\s*invitee\.id,\s*'match_invite'[\s\S]*?item\.id\s*\)/,
  );
});

test('resultErrorReports passes entity context for americano and league', () => {
  const src = readSrc('src/lib/resultErrorReports.js');
  assert.match(src, /sourceType === 'americano'/);
  assert.match(src, /entityType.*entityId/s);
  assert.match(src, /result_error_report/);
});

test('userModeration sends push to admins after report_user', () => {
  const src = readSrc('src/lib/userModeration.js');
  assert.match(src, /sendPushNotificationsForUsers/);
  assert.match(src, /result\.admin_ids/);
  assert.match(src, /user_report/);
});

test('LigaTab sends push for team invite flows', () => {
  const src = readSrc('src/dashboard/LigaTab.jsx');
  assert.match(src, /sendPushNotificationsForUsers/);
  assert.match(src, /team_invite/);
  assert.match(src, /team_invite_accepted/);
  assert.match(src, /team_invite_declined/);
  assert.match(src, /entityType:\s*['"]league['"]/);
});

test('NotificationBell invalidates prefs cache and rolls back on error', () => {
  const src = readSrc('src/components/NotificationBell.jsx');
  assert.match(src, /invalidateNotificationPrefsCache/);
  assert.match(src, /setNotifPrefs\(prevPrefs\)/);
  assert.match(src, /\.eq\("user_id", userId\)/);
  assert.match(src, /loadSeqRef/);
  assert.match(src, /realtimeInstanceRef/);
  assert.match(src, /loadRef\.current/);
  assert.match(src, /addDismissedIds\(userId, ids\)/);
  const deleteFn = src.slice(src.indexOf('const deleteNotificationItem'));
  const successDismiss = deleteFn.indexOf('addDismissedIds(userId, ids)');
  const deleteCall = deleteFn.indexOf('.delete()');
  assert.ok(successDismiss > deleteCall, 'addDismissedIds should run after delete in deleteNotificationItem');
});

test('AuthContext profile load retries and exposes profileLoadError', () => {
  const auth = readSrc('src/lib/AuthContext.jsx');
  const platform = readSrc('src/padelmakker-platform.jsx');
  assert.match(auth, /profileLoadError/);
  assert.match(auth, /fetchProfileFast\(userRow\)/);
  assert.match(auth, /\.maybeSingle\(\)/);
  assert.match(auth, /setProfileLoadError\(true\)/);
  assert.match(platform, /Kunne ikke hente din profil/);
  assert.match(platform, /refreshProfile/);
});

test('pushNotifications surfaces db_error on upsert failure', () => {
  const src = readSrc('src/lib/pushNotifications.js');
  assert.match(src, /upsertError/);
  assert.match(src, /return 'db_error'/);
});

test('send-push edge function implements invite and admin legitimacy rules', () => {
  const src = readSrc('supabase/functions/send-push/index.ts');
  assert.match(src, /americano_invite/);
  assert.match(src, /verifyAdminTargetPushLegitimacy/);
  assert.match(src, /result_error_reports/);
  assert.match(src, /user_reports/);
  assert.match(src, /seeking_player.*match_invite|match_invite.*seeking_player/s);
  assert.match(src, /entityType.*entityId/s);
  assert.match(src, /callerCanAccessMatch/);
});

test('migration drops duplicate notification RPC overloads', () => {
  const sql = readSrc('supabase/migrations/20260520193932_drop_duplicate_notification_rpc_overloads.sql');
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.create_notification_for_user\(uuid, text, text, text, uuid\)/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.create_notifications_for_users\(uuid\[\], text, text, text, uuid\)/);
});

test('migration SQL allows external match and americano invites', () => {
  const sql = readSrc('supabase/migrations/20260520193927_notification_invite_push_fixes.sql');
  assert.match(sql, /p_type = 'match_invite'/);
  assert.match(sql, /p_type = 'americano_invite'/);
  assert.match(sql, /admin_ids/);
  assert.match(sql, /notify_title/);
});

test('client and server push policies share core notification types', () => {
  const clientSrc = readSrc('src/lib/notificationPolicy.js');
  const serverSrc = readSrc('supabase/functions/send-push/index.ts');

  const clientTypes = [...clientSrc.matchAll(/^\s+([a-z_]+):\s*\{/gm)].map((m) => m[1]);
  const serverTypes = [...serverSrc.matchAll(/^\s+([a-z_]+):\s*\{/gm)]
    .map((m) => m[1])
    .filter((t) => !['channel', 'level', 'sendPush', 'silent', 'urgency'].includes(t));

  const critical = [
    'match_invite',
    'americano_invite',
    'seeking_player',
    'result_error_report',
    'user_report',
    'team_invite',
    'system_flag',
  ];

  for (const type of critical) {
    assert.ok(clientTypes.includes(type), `client missing ${type}`);
    assert.ok(serverTypes.includes(type), `server missing ${type}`);
  }
});

test('admin reports badge uses open queue only, not unread bell duplicates', () => {
  const src = readSrc('src/lib/userModeration.js');
  assert.match(src, /badges\.reports = Number\(openReports\)/);
  assert.doesNotMatch(src, /badges\.reports = Math\.max/);
  assert.match(src, /dismissAdminUserReportNotificationsIfQueueEmpty/);
});

test('marking user report reviewed clears stale user_report notifications when queue empty', () => {
  const adminSrc = readSrc('src/dashboard/AdminTab.jsx');
  assert.match(adminSrc, /dismissAdminUserReportNotificationsIfQueueEmpty/);
  assert.match(adminSrc, /nextStatus !== 'open'/);
});
