import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PLAY_TIME_BANDS,
  dayLabel,
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
  for (const type of ['match_proposal', 'match_proposal_confirmed', 'match_proposal_declined']) {
    assert.ok(policy.includes(`${type}:`), `${type} mangler i notificationPolicy`);
  }
});
