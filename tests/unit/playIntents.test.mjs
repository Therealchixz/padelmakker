import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PLAY_TIME_BANDS,
  dayLabel,
  deadlineInfo,
  isProposalNotification,
  isoDateOffset,
  shortTime,
  timeBandByKey,
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
  assert.equal(timeBandByKey('aften')?.start, '17:00');
  assert.equal(timeBandByKey('nat'), null);
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

test('shortTime klipper sekunder fra Postgres-tider', () => {
  assert.equal(shortTime('17:00:00'), '17:00');
  assert.equal(shortTime(null), '');
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

test('et tryk på en forslags-besked fører til Hjem, hvor kortet står', () => {
  for (const file of ['src/components/NotificationBell.jsx', 'src/pages/NotifikationerPage.jsx']) {
    const src = readFileSync(file, 'utf8');
    assert.match(
      src,
      /isProposalNotification\(n\?\.type\)/,
      `${file} navigerer ikke på forslags-beskeder`
    );
    assert.match(src, /navigate\('\/dashboard\/hjem'\)/, `${file} peger ikke på Hjem`);
    // Uden dette er beskeden ikke klikbar, og navigationen ovenfor er død kode.
    assert.match(src, /isProposalNotification\(n\.type\)/, `${file} markerer den ikke klikbar`);
  }
});
