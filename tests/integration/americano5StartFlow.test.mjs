/**
 * Integration: opret + start Americano med 5 spillere (samme logik som appen).
 * Kør: node --test tests/integration/americano5StartFlow.test.mjs
 * Live mod Supabase (valgfrit): sæt VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *   PLAYWRIGHT_TEST_SERVICE_ROLE_KEY og kør med --test-force-live
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

import { orderParticipantsForSchedule } from '../../src/lib/americanoParticipantOrder.ts';
import {
  americanoBaseRounds,
  benchCountPerRound,
  buildAmericanoRoundRobinMatchRows,
} from '../../src/lib/americanoRoundRobinSchedule.ts';
import { isValidAmericanoScore } from '../../src/lib/americanoScore.js';

const TOURNAMENT_ID = '99999999-aaaa-bbbb-cccc-dddd00000005';
const POINTS = 16;

function simulateStartTournament(participantIds, tournamentId = TOURNAMENT_ID) {
  const n = participantIds.length;
  if (n !== 5) throw new Error(`Forventede 5 deltagere, fik ${n}`);

  const scheduleOrder = orderParticipantsForSchedule(
    participantIds.map((id, i) => ({
      id,
      joined_at: new Date(Date.UTC(2026, 0, 1, 10, i, 0)).toISOString(),
    })),
    tournamentId,
  );

  const matchRows = buildAmericanoRoundRobinMatchRows(tournamentId, scheduleOrder, 1, 1);

  return { scheduleOrder, matchRows, joinOrder: participantIds };
}

function benchForRound(matchRows, scheduleOrder, roundNumber) {
  const m = matchRows.find((r) => r.round_number === roundNumber);
  assert.ok(m, `mangler runde ${roundNumber}`);
  const onCourt = new Set([m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]);
  return scheduleOrder.filter((id) => !onCourt.has(id));
}

test('simulerer opret+start: 5 spillere → 5 kampe, shuffle ≠ join-rækkefølge', () => {
  const joinOrder = ['part-0', 'part-1', 'part-2', 'part-3', 'part-4'];
  const { scheduleOrder, matchRows } = simulateStartTournament(joinOrder);

  assert.equal(matchRows.length, 5);
  assert.equal(americanoBaseRounds(5, 1), 5);
  assert.equal(benchCountPerRound(5, 1), 1);
  assert.notDeepEqual(scheduleOrder, joinOrder);

  const playCount = Object.fromEntries(scheduleOrder.map((id) => [id, 0]));
  for (const m of matchRows) {
    for (const pid of [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]) {
      playCount[pid] += 1;
    }
    const a = m.team_a_score;
    const b = m.team_b_score;
    if (a != null && b != null) {
      assert.ok(isValidAmericanoScore(a, b, POINTS));
    }
  }
  assert.deepEqual(Object.values(playCount), [4, 4, 4, 4, 4]);

  for (let r = 1; r <= 5; r++) {
    const bench = benchForRound(matchRows, scheduleOrder, r);
    assert.equal(bench.length, 1, `runde ${r} skal have præcis 1 på bænken`);
  }

  const benchSets = matchRows.map((_, i) => benchForRound(matchRows, scheduleOrder, i + 1).join(','));
  assert.equal(new Set(benchSets).size, 5, 'alle 5 skal sidde over præcis én gang');
});

test('alle runder har gyldige deltager-ids og ingen dobbeltbooking', () => {
  const joinOrder = ['a', 'b', 'c', 'd', 'e'];
  const { scheduleOrder, matchRows } = simulateStartTournament(joinOrder, '88888888-1111-2222-3333-444444444444');
  const roster = new Set(scheduleOrder);

  for (const m of matchRows) {
    for (const pid of [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]) {
      assert.ok(roster.has(pid), `ukendt deltager ${pid}`);
    }
    const four = [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2];
    assert.equal(new Set(four).size, 4, 'samme spiller to gange på banen');
  }
});

test('resultater kan udfyldes og summere til 16 for afslutning', () => {
  const { matchRows } = simulateStartTournament(['p1', 'p2', 'p3', 'p4', 'p5']);
  const scored = matchRows.map((m, i) => ({
    ...m,
    team_a_score: 10 - (i % 3),
    team_b_score: 16 - (10 - (i % 3)),
  }));
  for (const m of scored) {
    assert.ok(isValidAmericanoScore(m.team_a_score, m.team_b_score, POINTS));
    assert.equal(m.team_a_score + m.team_b_score, POINTS);
  }
});

const forceLive = process.argv.includes('--test-force-live') || process.env.AMERICANO_LIVE_TEST === '1';

test('LIVE: opret turnering i Supabase, start med 5, ryd op', { skip: !forceLive && !process.env.PLAYWRIGHT_TEST_SERVICE_ROLE_KEY }, async () => {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.PLAYWRIGHT_TEST_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    console.log('Springer live-test over — mangler VITE_SUPABASE_URL / PLAYWRIGHT_TEST_SERVICE_ROLE_KEY');
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, display_name')
    .limit(5);
  assert.ifError(profErr);
  assert.ok(profiles && profiles.length >= 5, `behøver mindst 5 profiler i DB, fandt ${profiles?.length ?? 0}`);

  const users = profiles.slice(0, 5);
  const creatorId = users[0].id;
  const tag = `e2e-5p-${Date.now()}`;

  const { data: tournament, error: tErr } = await admin
    .from('americano_tournaments')
    .insert({
      creator_id: creatorId,
      name: tag,
      tournament_date: new Date().toISOString().slice(0, 10),
      time_slot: '18:00',
      court_id: null,
      player_slots: 5,
      courts_per_round: 1,
      points_per_match: 16,
      opponent_passes: 1,
      format: 'americano',
      status: 'registration',
    })
    .select('id')
    .single();
  assert.ifError(tErr);
  assert.ok(tournament?.id);

  const tid = tournament.id;

  try {
    const partRows = users.map((u) => ({
      tournament_id: tid,
      user_id: u.id,
      display_name: u.display_name || 'Test',
    }));
    const { data: parts, error: pErr } = await admin
      .from('americano_participants')
      .insert(partRows)
      .select('id, joined_at')
      .order('joined_at', { ascending: true });
    assert.ifError(pErr);
    assert.equal(parts?.length, 5);

    const scheduleOrder = orderParticipantsForSchedule(
      parts.map((p) => ({ id: p.id, joined_at: p.joined_at })),
      tid,
    );
    const matchRows = buildAmericanoRoundRobinMatchRows(tid, scheduleOrder, 1, 1);
    assert.equal(matchRows.length, 5);

    const { error: mErr } = await admin.from('americano_matches').insert(matchRows);
    assert.ifError(mErr);

    const { error: uErr } = await admin
      .from('americano_tournaments')
      .update({ status: 'playing', updated_at: new Date().toISOString() })
      .eq('id', tid);
    assert.ifError(uErr);

    const { data: dbMatches, error: fetchErr } = await admin
      .from('americano_matches')
      .select('id, round_number')
      .eq('tournament_id', tid)
      .order('round_number');
    assert.ifError(fetchErr);
    assert.equal(dbMatches?.length, 5);

    for (const m of dbMatches) {
      const { error: sErr } = await admin
        .from('americano_matches')
        .update({ team_a_score: 10, team_b_score: 6, results_locked: true })
        .eq('id', m.id);
      assert.ifError(sErr);
    }

    const { data: eloRes, error: cErr } = await admin.rpc('complete_americano_tournament', {
      p_tournament_id: tid,
    });
    if (cErr) {
      throw new Error(`complete_americano_tournament: ${cErr.message}`);
    }
    assert.ok(eloRes?.success !== false, JSON.stringify(eloRes));

    const { data: done, error: dErr } = await admin
      .from('americano_tournaments')
      .select('status')
      .eq('id', tid)
      .single();
    assert.ifError(dErr);
    assert.equal(done?.status, 'completed');

    console.log(`✓ Live Americano 5p OK — turnering ${tid} (${tag})`);
  } finally {
    await admin.from('americano_tournaments').delete().eq('id', tid);
  }
});
