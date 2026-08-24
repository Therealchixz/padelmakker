import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PLAY_START_SLOTS,
  PLAY_TIME_BANDS,
  PLAY_TIME_SLOTS,
  PLAY_WINDOW_PRESETS,
  PLAY_ALL_DAY,
  isAllDayWindow,
  dayChoiceLabel,
  dayLabel,
  dateBadge,
  deadlineInfo,
  endSlotsAfter,
  formatSelectedDays,
  isProposalNotification,
  isActionableProposalNotification,
  proposalIdFromNotification,
  buildProposalFocusPath,
  parseProposalFocusId,
  pickFocusedProposal,
  proposalMemberStatusLabel,
  normalizePendingProposals,
  isValidPlayWindow,
  isoDateOffset,
  matchingPresetKey,
  shortTime,
  compactHourRange,
  timeBandByKey,
  toggleSelectedDay,
  uniqueOverlappingMatches,
  overlappingMatchToast,
} from '../../src/lib/playIntentUtils.js';

const POOL_SQL = readFileSync('supabase/sql/play_intent_pool.sql', 'utf8');

test('alle tidsbånd er mindst 90 minutter — ellers afviser RPC dem', () => {
  for (const band of PLAY_TIME_BANDS) {
    const [sh, sm] = band.start.split(':').map(Number);
    const [eh, em] = band.end.split(':').map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    assert.ok(minutes >= 90, `${band.key} er kun ${minutes} min`);
  }
});

test('timeBandByKey finder bånd og returnerer null for ukendte', () => {
  assert.equal(timeBandByKey('aften')?.start, '18:00');
  assert.equal(timeBandByKey('nat'), null);
});

test('hurtige valg overlapper ikke og dækker 06:00–23:30', () => {
  assert.equal(PLAY_WINDOW_PRESETS[0].start, '06:00');
  assert.equal(PLAY_WINDOW_PRESETS.at(-1).end, '23:30');
  for (let i = 1; i < PLAY_WINDOW_PRESETS.length; i += 1) {
    const prev = PLAY_WINDOW_PRESETS[i - 1];
    const cur = PLAY_WINDOW_PRESETS[i];
    assert.equal(prev.end, cur.start, `${prev.key} og ${cur.key} overlapper`);
  }
});

test('hele dagen er 06:00–23:30 og vises som eget valg', () => {
  assert.equal(PLAY_ALL_DAY.start, '06:00');
  assert.equal(PLAY_ALL_DAY.end, '23:30');
  assert.equal(isAllDayWindow('06:00', '23:30'), true);
  assert.equal(isAllDayWindow('06:00:00', '23:30:00'), true);
  assert.equal(isAllDayWindow('18:00', '21:00'), false);
  assert.equal(matchingPresetKey('06:00', '23:30'), 'hele');
  assert.equal(compactHourRange('06:00', '23:30'), 'hele dagen');
});

test('10:00–12:00 er ét gyldigt vindue, 10:00–11:00 er for kort', () => {
  assert.equal(isValidPlayWindow('10:00', '12:00'), true);
  assert.equal(matchingPresetKey('10:00', '12:00'), null);
  assert.equal(isValidPlayWindow('10:00', '11:00'), false);
  assert.equal(endSlotsAfter('10:00')[0], '11:30');
});

test('starttider slutter, når der ikke er 1½ time tilbage', () => {
  assert.equal(PLAY_TIME_SLOTS[0], '06:00');
  assert.equal(PLAY_TIME_SLOTS.at(-1), '23:30');
  assert.equal(PLAY_START_SLOTS[0], '06:00');
  assert.equal(PLAY_START_SLOTS.at(-1), '22:00');
  assert.equal(endSlotsAfter('22:00').at(-1), '23:30');
  assert.deepEqual(endSlotsAfter('22:30'), []);
});

test('dayChoiceLabel siger I dag og I morgen i stedet for ugedagen', () => {
  assert.equal(dayChoiceLabel(isoDateOffset(0)), 'I dag');
  assert.equal(dayChoiceLabel(isoDateOffset(1)), 'I morgen');
  const later = isoDateOffset(3);
  assert.equal(dayChoiceLabel(later), dayLabel(later));
});

test('toggleSelectedDay lader én vælge flere dage uden at tømme listen', () => {
  const a = isoDateOffset(0);
  const b = isoDateOffset(1);
  const c = isoDateOffset(2);
  assert.deepEqual(toggleSelectedDay([a], a), [a]);
  assert.deepEqual(toggleSelectedDay([a], b), [a, b].sort());
  assert.deepEqual(toggleSelectedDay([a, b], a), [b]);
  assert.deepEqual(toggleSelectedDay([c, a], b), [a, b, c]);
});

test('formatSelectedDays beskriver en, to eller flere dage', () => {
  const today = isoDateOffset(0);
  const tomorrow = isoDateOffset(1);
  assert.equal(formatSelectedDays([today]), 'i dag');
  assert.equal(formatSelectedDays([today, tomorrow]), 'i dag og i morgen');
  assert.equal(formatSelectedDays(['2026-08-25', '2026-08-26', '2026-08-27']), '3 dage');
  assert.equal(formatSelectedDays([]), '');
});

test('isoDateOffset giver gyldige ISO-datoer og bevæger sig fremad', () => {
  const today = isoDateOffset(0);
  const later = isoDateOffset(7);
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(later, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(later > today);
});

test('dayLabel viser dansk ugedag og dato', () => {
  // 2026-08-25 er en tirsdag.
  assert.equal(dayLabel('2026-08-25'), 'Tir 25/8');
  assert.equal(dayLabel(''), '');
});

test('dateBadge giver dagtal og trebogstavs-måned til kortet', () => {
  assert.deepEqual(dateBadge('2026-08-24'), { day: '24', month: 'AUG' });
  assert.deepEqual(dateBadge(''), { day: '', month: '' });
});

test('aktive hensigter vises som chips under knappen', () => {
  const src = readFileSync('src/components/PlayIntentPanel.jsx', 'utf8');
  assert.match(src, /pm-play-intent-block/);
  assert.match(src, /pm-play-intent-chips/);
  assert.match(src, /pm-play-intent-chip__x/);
  assert.match(src, /åben kamp i samme hul/);
});

test('shortTime klipper sekunder fra Postgres-tider', () => {
  assert.equal(shortTime('17:00:00'), '17:00');
  assert.equal(shortTime(null), '');
});

test('compactHourRange forkorter hele timer på chips', () => {
  assert.equal(compactHourRange('17:00', '23:00'), '17–23');
  assert.equal(compactHourRange('07:00:00', '11:00'), '7–11');
  assert.equal(compactHourRange('17:30', '21:00'), '17:30–21');
  assert.equal(compactHourRange(null, '21:00'), '');
});

test('nedtælling viser dage, timer og minutter', () => {
  const now = Date.UTC(2026, 7, 20, 12, 0, 0);
  const at = (ms) => deadlineInfo(new Date(now + ms).toISOString(), now);

  assert.equal(at(26 * 3600e3).label, '1 dag tilbage');
  assert.equal(at(5 * 3600e3).label, '5 timer tilbage');
  assert.equal(at(3600e3).label, '1 time tilbage');
  assert.equal(at(25 * 60e3).label, '25 min tilbage');
  assert.equal(at(20e3).label, 'Under 1 min tilbage');
});

test('de sidste tre timer markeres som hastende — der skal nås en banebooking', () => {
  const now = Date.UTC(2026, 7, 20, 12, 0, 0);
  const at = (ms) => deadlineInfo(new Date(now + ms).toISOString(), now);

  assert.equal(at(5 * 3600e3).urgent, false);
  assert.equal(at(2 * 3600e3).urgent, true);
  assert.equal(at(40 * 60e3).urgent, true);
});

test('udløbet frist markeres, så knappen kan slås fra', () => {
  const now = Date.UTC(2026, 7, 20, 12, 0, 0);
  const past = deadlineInfo(new Date(now - 60e3).toISOString(), now);
  assert.equal(past.expired, true);
  assert.equal(past.label, 'Udløbet');

  // Præcis på fristen tæller som udløbet — ikke "0 min tilbage".
  assert.equal(deadlineInfo(new Date(now).toISOString(), now).expired, true);
});

test('deadlineInfo er robust over for manglende eller ugyldig dato', () => {
  assert.equal(deadlineInfo(null), null);
  assert.equal(deadlineInfo('ikke en dato'), null);
});

test('en hensigt matcher også åbne kampe i samme tidsrum', () => {
  const notifySql = readFileSync('supabase/sql/play_intent_open_match_notify.sql', 'utf8');
  assert.match(notifySql, /FROM public\.play_intents i/);
  assert.match(notifySql, /play_intent_overlaps_match_time/);
  assert.match(notifySql, /overlapping_matches/);
  assert.match(POOL_SQL, /overlapping_matches/);
  assert.match(POOL_SQL, /play_intent_overlaps_match_time/);
});

test('toast beskriver én eller flere overlappinge åbne kampe', () => {
  assert.equal(overlappingMatchToast([]), '');
  assert.match(
    overlappingMatchToast([{ id: 'a', court_name: 'Padel House', time: '18:00' }]),
    /Padel House/
  );
  assert.match(
    overlappingMatchToast([
      { id: 'a', court_name: 'Padel House', time: '18:00' },
      { id: 'b', court_name: 'Anden hal', time: '19:00' },
    ]),
    /2 åbne kampe/
  );
  assert.equal(
    uniqueOverlappingMatches([
      { overlappingMatches: [{ id: 'a', court_name: 'A' }] },
      { overlappingMatches: [{ id: 'a', court_name: 'A' }, { id: 'b', court_name: 'B' }] },
    ]).length,
    2,
  );
});

test('puljen kræver fire spillere før der dannes et forslag', () => {
  assert.match(POOL_SQL, /v_needed\s+constant\s+integer\s*:=\s*4/);
  assert.match(POOL_SQL, /IF array_length\(v_sel_ids, 1\) < v_needed THEN/);
});

test('kandidater tjekkes mod alle valgte, ikke kun seed-spilleren', () => {
  // Uden dette kan to yderpunkter ligge dobbelt så langt fra hinanden som radius.
  assert.match(POOL_SQL, /FOR v_i IN 1 \.\. array_length\(v_sel_ids, 1\) LOOP/);
  assert.match(POOL_SQL, /haversine_km\(v_sel_lat\[v_i\], v_sel_lon\[v_i\]/);
});

test('profiles.level castes til numeric — ellers fejler funktionsopslaget', () => {
  assert.match(POOL_SQL, /match_filter_prefs_level\('\{\}'::jsonb, v_profile\.level::numeric\)/);
});

test('en afvisning frigiver de øvriges hensigter til puljen igen', () => {
  assert.match(
    POOL_SQL,
    /UPDATE public\.play_intents SET status = 'open', proposal_id = NULL\s*\n\s*WHERE proposal_id = p_proposal_id AND status = 'proposed';/
  );
});

test('kampen oprettes først når ingen mangler at acceptere', () => {
  assert.match(POOL_SQL, /WHERE proposal_id = p_proposal_id AND response <> 'accepted'/);
  assert.match(POOL_SQL, /IF v_pending > 0 THEN/);
});

test('skrivning til pulje-tabeller går kun gennem RPC', () => {
  for (const table of ['play_intents', 'match_proposals', 'match_proposal_members']) {
    assert.match(
      POOL_SQL,
      new RegExp(`REVOKE INSERT, UPDATE, DELETE ON public\\.${table} FROM authenticated;`),
      `${table} mangler REVOKE`
    );
  }
});

test('oprydning skelner mellem dem der sagde ja og dem der aldrig svarede', () => {
  // Uden dette skel ville næste kørsel danne præcis samme døde gruppe igen.
  assert.match(POOL_SQL, /SET status = 'open', proposal_id = NULL[\s\S]{0,320}?m\.response = 'accepted'/);
  assert.match(POOL_SQL, /SET status = 'cancelled', proposal_id = NULL[\s\S]{0,320}?m\.response <> 'accepted'/);
});

test('oprydningen er sat på skema hvert 15. minut', () => {
  assert.match(POOL_SQL, /cron\.schedule\(\s*'expire-play-intents',\s*'\*\/15 \* \* \* \*'/);
  assert.match(POOL_SQL, /cron\.unschedule\('expire-play-intents'\)/);
});

test('notifikationspolitik dækker de nye forslags-typer', () => {
  const policy = readFileSync('src/lib/notificationPolicy.js', 'utf8');
  for (const type of [
    'match_proposal',
    'match_proposal_reminder',
    'match_proposal_confirmed',
    'match_proposal_declined',
  ]) {
    assert.ok(policy.includes(`${type}:`), `${type} mangler i notificationPolicy`);
  }
});

test('når fire matcher, pusher klienten til alle medlemmer — ikke kun de tre andre', () => {
  const src = readFileSync('src/lib/playIntents.js', 'utf8');
  assert.match(src, /proposal\.member_ids/);
  assert.match(src, /sendPushNotificationsForUsers/);
  assert.match(src, /entityType:\s*'match_proposal'/);
  assert.doesNotMatch(src, /id !== viewerId/);
});

test('send-push tillader kamp-forslag når kalderen selv er med i forslaget', () => {
  const src = readFileSync('supabase/functions/send-push/index.ts', 'utf8');
  assert.match(src, /type === "match_proposal"/);
  assert.match(src, /match_proposal_members/);
  assert.match(src, /normalizedEntityType === "match_proposal"/);
});

test('dispatch-push bruger Declarative Web Push så iOS kan vise låseskærm uden service worker', () => {
  const src = readFileSync('supabase/functions/dispatch-push/index.ts', 'utf8');
  assert.match(src, /web_push:\s*8030/);
  assert.match(src, /navigateForType/);
  assert.match(src, /dashboard\/hjem\?forslag=/);
});

test('tryk på kamp-push åbner forslagspopuppen, ikke bare Hjem', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  const sendPush = readFileSync('supabase/functions/send-push/index.ts', 'utf8');
  assert.match(sw, /hjem\?forslag=/);
  assert.match(sendPush, /hjem\?forslag=/);
});

test('når fire matcher, ringer SQL telefonen via dispatch-push — ikke kun klokken', () => {
  const helper = readFileSync('supabase/sql/dispatch_push_to_user.sql', 'utf8');
  const trigger = readFileSync('supabase/sql/dispatch_push_on_match_proposal.sql', 'utf8');
  assert.match(helper, /CREATE OR REPLACE FUNCTION public\.dispatch_push_to_user/);
  assert.match(helper, /functions\/v1\/dispatch-push/);
  assert.match(trigger, /notifications_dispatch_match_proposal/);
  assert.match(trigger, /NEW\.type IN \('match_proposal', 'match_proposal_reminder'\)/);
});

const REMINDER_SQL = readFileSync('supabase/sql/match_proposal_reminders.sql', 'utf8');
const REMINDER_FN = readFileSync('supabase/functions/send-reminders/index.ts', 'utf8');

test('kun dem der endnu ikke har svaret får en påmindelse', () => {
  assert.match(REMINDER_SQL, /pr\.status = 'pending'/);
  assert.match(REMINDER_SQL, /mem\.response = 'pending'/);
});

test('påmindelsen sendes i tide, men ikke oveni selve forslaget', () => {
  // Under 20 min når skubbet ikke frem, og et forslag med kort lunte er lige
  // blevet varslet — begge grænser skal stå, ellers bliver det støj.
  assert.match(
    REMINDER_SQL,
    /pr\.expires_at between now\(\) \+ interval '20 minutes' and now\(\) \+ interval '3 hours'/
  );
  assert.match(REMINDER_SQL, /pr\.created_at <= now\(\) - interval '45 minutes'/);
});

test('påmindelsen genbruger reminder_log, så ingen skubbes to gange', () => {
  assert.match(REMINDER_SQL, /union all select \* from proposal_deadlines/);
  assert.match(REMINDER_SQL, /from reminder_log rl/);
});

test('påmindelsen sendes som invitation, ikke som stille kamp-besked', () => {
  assert.match(REMINDER_FN, /proposal_deadline"\s*\?\s*"invitation"/);
  assert.match(REMINDER_FN, /if \(row\.kind === "proposal_deadline"\) return "match_proposal_reminder";/);
  assert.match(REMINDER_FN, /urgency: urgent \? "high" : "normal"/);
});

test('påmindelsen peger på forslaget, så trykket fører det rigtige sted hen', () => {
  assert.match(REMINDER_FN, /entityType: "match_proposal", entityId: row\.entity_id/);
});

test('push-kanalen følger beskeden i stedet for altid at være kampe', () => {
  assert.match(REMINDER_FN, /pushBucket\[channel\] === false/);
});

test('forslags-beskeder genkendes, men ikke bekræftelsen der peger på kampen', () => {
  assert.equal(isProposalNotification('match_proposal'), true);
  assert.equal(isProposalNotification('match_proposal_reminder'), true);
  assert.equal(isProposalNotification('match_proposal_declined'), true);
  // Bekræftede forslag har et rigtigt match_id og hører hjemme i Kampe.
  assert.equal(isProposalNotification('match_proposal_confirmed'), false);
  assert.equal(isProposalNotification('match_reminder'), false);
  assert.equal(isProposalNotification(null), false);
});

test('et tryk på en forslags-besked åbner ja/nej-popuppen på Hjem', () => {
  for (const file of ['src/components/NotificationBell.jsx', 'src/pages/NotifikationerPage.jsx']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /resolveNotificationClickTarget/, `${file} bruger ikke fælles klik-routing`);
  }
  const panel = readFileSync('src/components/PlayIntentPanel.jsx', 'utf8');
  assert.match(panel, /parseProposalFocusId/);
  assert.match(panel, /pickFocusedProposal/);
  assert.match(panel, /ariaLabel="Bekræft jeres kamp"/);
});

test('forslags-medlemmer kan læses uden RLS-recursion', () => {
  const sql = readFileSync('supabase/sql/play_intent_pool.sql', 'utf8');
  const policy = sql.match(/CREATE POLICY match_proposal_members_select_member[\s\S]*?;/)?.[0] || '';
  assert.match(policy, /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.doesNotMatch(
    policy,
    /match_proposal_members mine/,
    'self-join i policy giver infinite recursion',
  );
});

test('ja/nej-kassen viser de fire spillere, ikke kun tidspunktet', () => {
  assert.match(POOL_SQL, /CREATE OR REPLACE FUNCTION public\.list_pending_match_proposals\(\)/);
  assert.match(POOL_SQL, /'name', COALESCE\(NULLIF\(btrim\(pr\.full_name\)/);
  assert.match(POOL_SQL, /'is_me', m\.user_id = v_caller/);
  const client = readFileSync('src/lib/playIntents.js', 'utf8');
  assert.match(client, /list_pending_match_proposals/);
  const panel = readFileSync('src/components/PlayIntentPanel.jsx', 'utf8');
  assert.match(panel, /proposal\.members/);
  assert.match(panel, /AvatarCircle/);
  assert.match(panel, /proposalMemberStatusLabel/);
});

test('normalizePendingProposals bevarer spillernavne og ignorerer udløbne', () => {
  const now = Date.parse('2026-08-25T12:00:00Z');
  const rows = normalizePendingProposals([
    {
      id: 'alive',
      expires_at: '2026-08-25T22:00:00Z',
      members: [{ name: 'Kevin Rastung', is_me: false }],
    },
    { id: 'dead', expires_at: '2026-08-25T10:00:00Z', members: [{ name: 'Gammel' }] },
  ], now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].members[0].name, 'Kevin Rastung');
  assert.deepEqual(normalizePendingProposals('not-json'), []);
  assert.deepEqual(normalizePendingProposals(null), []);
});

test('proposalMemberStatusLabel skelner dig fra de andre', () => {
  assert.equal(proposalMemberStatusLabel('pending', true), 'Dig');
  assert.equal(proposalMemberStatusLabel('accepted', false), 'Har sagt ja');
  assert.equal(proposalMemberStatusLabel('pending', false), 'Afventer');
});

test('forslags-deeplink åbner et konkret forslag, eller det første ventende', () => {
  assert.equal(isActionableProposalNotification('match_proposal'), true);
  assert.equal(isActionableProposalNotification('match_proposal_reminder'), true);
  assert.equal(isActionableProposalNotification('match_proposal_declined'), false);
  assert.equal(proposalIdFromNotification({ entity_id: 'abc' }), 'abc');
  assert.equal(proposalIdFromNotification({ entityId: 'xyz' }), 'xyz');
  assert.equal(proposalIdFromNotification({}), null);
  assert.equal(buildProposalFocusPath('p-1'), '/dashboard/hjem?forslag=p-1');
  assert.equal(buildProposalFocusPath(null), '/dashboard/hjem?forslag=open');
  assert.equal(parseProposalFocusId('?forslag=p-1'), 'p-1');
  assert.equal(parseProposalFocusId('?tab=x'), null);
  const rows = [{ id: 'a' }, { id: 'b' }];
  assert.equal(pickFocusedProposal(rows, 'b')?.id, 'b');
  assert.equal(pickFocusedProposal(rows, 'open')?.id, 'a');
  assert.equal(pickFocusedProposal(rows, 'missing'), null);
});
