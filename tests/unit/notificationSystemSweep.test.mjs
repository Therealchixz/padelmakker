import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  listNotificationPolicyTypes,
  resolveNotificationPushPolicy,
} from '../../src/lib/notificationPolicy.js';
import { resolveNotificationClickTarget } from '../../src/lib/notificationClickTarget.js';
import { KAMPE_NOTIFICATION_TYPES } from '../../src/lib/kampeNotificationTypes.js';
import { isProposalNotification } from '../../src/lib/playIntentUtils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const POLICY_TYPES = listNotificationPolicyTypes();

/** Typer brugeren forventer at kunne åbne. */
const MUST_OPEN = {
  match_invite: 'kampe-focus',
  match_join: 'kampe-focus',
  match_full: 'kampe-focus',
  match_cancelled: 'kampe-focus',
  match_chat: 'kampe-focus',
  match_reminder: 'kampe-focus',
  result_submitted: 'kampe-focus',
  result_confirmed: 'kampe-focus',
  seeking_player: 'kampe-focus',
  match_watch_match: 'kampe-focus',
  americano_invite: 'kampe-focus',
  americano_full: 'kampe-focus',
  americano_started: 'kampe-focus',
  americano_completed: 'kampe-focus',
  americano_cancelled: 'kampe-focus',
  americano_spot_open: 'kampe-focus',
  league_full: 'kampe-focus',
  league_started: 'kampe-focus',
  league_completed: 'kampe-focus',
  team_invite: 'kampe-focus',
  team_invite_accepted: 'kampe-focus',
  team_invite_declined: 'kampe-focus',
  tournament_reminder: 'kampe-focus',
  makker_suggestion: 'makker',
  match_proposal: 'proposal-popup',
  match_proposal_reminder: 'proposal-popup',
  match_proposal_declined: 'home',
  match_proposal_confirmed: 'kampe-focus',
  open_matches_weekly: 'kampe-list',
  elo_change: 'profile',
  result_error_report: 'admin',
  user_report: 'admin',
  growth_campaign_winner: 'home',
};

/** Skal ringe på låseskærmen — ikke stille in-app-only. */
const MUST_BE_AUDIBLE = [
  'match_invite',
  'americano_invite',
  'match_cancelled',
  'result_submitted',
  'makker_suggestion',
  'match_watch_match',
  'match_proposal',
  'match_proposal_reminder',
  'match_proposal_confirmed',
  'team_invite',
  'americano_cancelled',
  'match_reminder',
  'tournament_reminder',
  'growth_campaign_winner',
  'system_flag',
  'result_error_report',
  'user_report',
];

function fixtureFor(type) {
  if (type === 'makker_suggestion') {
    return { type, entity_type: 'profile', entity_id: 'profile-1' };
  }
  if (isProposalNotification(type) || type === 'match_proposal_confirmed') {
    return {
      type,
      entity_type: 'match_proposal',
      entity_id: 'proposal-1',
      match_id: type === 'match_proposal_confirmed' ? 'match-1' : null,
    };
  }
  if (type.startsWith('americano_') || type === 'tournament_reminder') {
    return { type, entity_type: 'americano', entity_id: 'am-1' };
  }
  if (type.startsWith('league_') || type.startsWith('team_')) {
    return { type, entity_type: 'league', entity_id: 'lg-1' };
  }
  if (type === 'result_error_report' || type === 'user_report') {
    return { type };
  }
  if (type === 'open_matches_weekly' || type === 'elo_change' || type === 'growth_campaign_winner' || type === 'welcome' || type === 'system_flag' || type === 'result_nudge') {
    return { type };
  }
  return { type, match_id: 'match-1' };
}

test('alle policy-typer har en klik-destination (eller er bevidst in-app-only)', () => {
  const inAppOnly = new Set(['welcome', 'system_flag', 'result_nudge']);
  const missing = [];
  for (const type of POLICY_TYPES) {
    const target = resolveNotificationClickTarget(fixtureFor(type), { isAdmin: true });
    if (MUST_OPEN[type]) {
      assert.equal(
        target?.kind,
        MUST_OPEN[type],
        `${type} skulle åbne som ${MUST_OPEN[type]}, fik ${target?.kind || 'null'} (${target?.path || '-'})`,
      );
      assert.ok(target?.path?.startsWith('/dashboard'), `${type} path ${target?.path}`);
    } else if (!inAppOnly.has(type) && !target) {
      missing.push(type);
    }
  }
  assert.deepEqual(missing, [], `Typer uden klik-destination: ${missing.join(', ')}`);
});

test('låseskærm-typer er hørbare (silent:false, sendPush:true)', () => {
  for (const type of MUST_BE_AUDIBLE) {
    const policy = resolveNotificationPushPolicy(type);
    assert.equal(policy.sendPush, true, `${type} sendPush`);
    assert.equal(policy.silent, false, `${type} silent`);
  }
});

test('ukendte typer forbliver stille som default — ikke et nyt lock-screen-hul', () => {
  const policy = resolveNotificationPushPolicy('brand_new_type');
  assert.equal(policy.silent, true);
  assert.equal(policy.sendPush, true);
});

test('klokke og notifikationsside bruger den fælles klik-resolver', () => {
  for (const file of ['src/components/NotificationBell.jsx', 'src/pages/NotifikationerPage.jsx']) {
    const src = read(file);
    assert.match(src, /resolveNotificationClickTarget/, `${file} bruger ikke fælles klik-routing`);
  }
});

test('mobil-siden har Aktiver/Slå fra', () => {
  const page = read('src/pages/NotifikationerPage.jsx');
  const controls = read('src/components/NotificationPushControls.jsx');
  assert.match(page, /NotificationPushControls/);
  assert.match(controls, /Slå fra/);
  assert.match(controls, /Aktiver/);
});

test('kamp-forslag åbner popup, ikke kun Hjem', () => {
  const target = resolveNotificationClickTarget({
    type: 'match_proposal',
    entity_id: 'abc-123',
  });
  assert.equal(target.kind, 'proposal-popup');
  assert.equal(target.path, '/dashboard/hjem?forslag=abc-123');
  const panel = read('src/components/PlayIntentPanel.jsx');
  assert.match(panel, /parseProposalFocusId/);
  assert.match(panel, /ariaLabel="Bekræft jeres kamp"/);
});

test('makker-besked åbner profilen', () => {
  const target = resolveNotificationClickTarget({
    type: 'makker_suggestion',
    entity_id: 'kevin-id',
  });
  assert.equal(target.path, '/dashboard/makkere?profile=kevin-id');
  assert.equal(resolveNotificationClickTarget({ type: 'makker_suggestion' }), null);
});

test('send-push og klient-policy dækker de samme typer', () => {
  const sendPush = read('supabase/functions/send-push/index.ts');
  const start = sendPush.indexOf('PUSH_POLICY_BY_TYPE');
  const slice = sendPush.slice(start, start + 14000);
  const serverKeys = [...slice.matchAll(/^\s+([a-z_]+):\s*\{/gm)].map((m) => m[1]);
  const missingOnServer = POLICY_TYPES.filter((t) => !serverKeys.includes(t));
  const extraOnServer = serverKeys.filter((t) => !POLICY_TYPES.includes(t));
  assert.deepEqual(missingOnServer, [], `send-push mangler: ${missingOnServer.join(', ')}`);
  assert.deepEqual(extraOnServer, [], `send-push har ekstra: ${extraOnServer.join(', ')}`);
});

test('send-push tillader makker- og kamp-push på tværs af brugere', () => {
  const src = read('supabase/functions/send-push/index.ts');
  assert.match(src, /type === "makker_suggestion"/);
  assert.match(src, /normalizedEntityType === "profile"/);
  assert.match(src, /type === "match_proposal"/);
  assert.match(src, /match_proposal_members/);
});

test('SQL ringer telefonen på kamp-forslag når ingen sidder i appen', () => {
  const trigger = read('supabase/sql/dispatch_push_on_match_proposal.sql');
  assert.match(trigger, /notifications_dispatch_match_proposal/);
  assert.match(trigger, /match_proposal_reminder/);
  assert.match(trigger, /dispatch_push_to_user/);
});

test('lock-screen-klik og declarative navigate peger på forslagspopup og makker', () => {
  const sw = read('public/sw.js');
  const dispatch = read('supabase/functions/dispatch-push/index.ts');
  const sendPush = read('supabase/functions/send-push/index.ts');
  assert.match(sw, /hjem\?forslag=/);
  assert.match(dispatch, /hjem\?forslag=/);
  assert.match(dispatch, /dashboard\/makkere/);
  assert.match(sendPush, /hjem\?forslag=/);
});

test('Kampe-typer ligger i policy, så de ikke falder tilbage til stille default', () => {
  for (const type of KAMPE_NOTIFICATION_TYPES) {
    assert.ok(POLICY_TYPES.includes(type), `${type} mangler i notificationPolicy`);
  }
});

test('createNotification sender altid entity-args (ingen RPC-overload)', () => {
  const src = read('src/lib/notifications.js');
  assert.match(src, /p_entity_type: entityType/);
  assert.match(src, /p_entity_id: entityId/);
  assert.doesNotMatch(src, /if \(!entityType \|\| !entityId\) return \{\}/);
});
