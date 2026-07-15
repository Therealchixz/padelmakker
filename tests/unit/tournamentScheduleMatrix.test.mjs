/**
 * Matematisk/kodningsmæssig matrix: Americano + Mexicano for mange (n × baner × passes).
 *
 * Americano clamp'er baner til præcis floor(n/4) (kan ikke vælge færre).
 * Mexicano tillader 1..floor(n/4) baner.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAmericanoRoundRobinMatchRows,
  americanoTotalRounds,
  benchCountPerRound,
  recommendedCourtsPerRound,
} from '../../src/lib/americanoRoundRobinSchedule.ts';
import {
  buildMexicanoRoundMatches,
  buildNextMexicanoRoundIfReady,
  getMexicanoTotalRounds,
  isRoundComplete,
} from '../../src/lib/mexicanoSchedule.js';

const P = 16;

function ids(n) {
  return Array.from({ length: n }, (_, i) => `p${i}`);
}

function maxCourts(n) {
  return Math.max(1, Math.floor(n / 4));
}

function assertValidRound(rows, roundNumber, n, courts) {
  const roundRows = rows.filter((r) => r.round_number === roundNumber);
  assert.equal(roundRows.length, courts, `runde ${roundNumber}: forventede ${courts} kampe`);
  const onCourt = [];
  for (const r of roundRows) {
    const four = [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2];
    assert.equal(new Set(four).size, 4, `runde ${roundNumber} bane ${r.court_index}: 4 unikke spillere`);
    for (const id of four) {
      assert.ok(ids(n).includes(id), `ukendt id ${id}`);
      onCourt.push(id);
    }
  }
  assert.equal(new Set(onCourt).size, onCourt.length, `runde ${roundNumber}: ingen spiller i to kampe`);
  assert.equal(onCourt.length, courts * 4);
  const indexes = roundRows.map((r) => Number(r.court_index ?? 0)).sort((a, b) => a - b);
  assert.deepEqual(indexes, Array.from({ length: courts }, (_, i) => i));
}

function lockRound(rows, roundNumber, pointsPerMatch = P) {
  return rows
    .filter((r) => r.round_number === roundNumber)
    .map((r, i) => {
      const a = 8 + (i % 5);
      const b = pointsPerMatch - a;
      return {
        ...r,
        team_a_score: a,
        team_b_score: b,
        results_locked: true,
      };
    });
}

// ── Americano ───────────────────────────────────────────────────────────────

test('Americano anbefalet baner = floor(n/4) for 4–16', () => {
  for (let n = 4; n <= 16; n += 1) {
    assert.equal(recommendedCourtsPerRound(n), Math.floor(n / 4));
  }
});

test('Americano matrix: 4–16 spillere × Normal/Lang med effektiv bane-clamp', () => {
  const failures = [];
  for (let n = 4; n <= 16; n += 1) {
    const courts = recommendedCourtsPerRound(n);
    for (const passes of [1, 2]) {
      try {
        const participantIds = ids(n);
        // Bed også om "for få" baner — skal clampes op til recommended.
        const rows = buildAmericanoRoundRobinMatchRows('t-matrix', participantIds, 1, passes);
        const totalRounds = americanoTotalRounds(n, courts, passes);
        const rounds = [...new Set(rows.map((r) => r.round_number))].sort((a, b) => a - b);
        assert.equal(rounds.length, totalRounds, `${n}p/pass${passes}: rundeantal`);
        assert.equal(rounds[0], 1);
        assert.equal(rounds[rounds.length - 1], totalRounds);
        assert.equal(rows.length, totalRounds * courts, `${n}p: #kampe`);
        assert.equal(benchCountPerRound(n, 1), n - courts * 4);
        for (const rn of rounds) assertValidRound(rows, rn, n, courts);

        // Samme plan når man eksplicit angiver recommended courts.
        const rowsExplicit = buildAmericanoRoundRobinMatchRows('t-matrix', participantIds, courts, passes);
        assert.equal(rowsExplicit.length, rows.length);
      } catch (err) {
        failures.push(`${n}p/pass${passes}: ${err.message || err}`);
      }
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 12).join('\n'));
});

test('Americano: 8 spillere clamps til 2 baner (ingen 1-bane-mode)', () => {
  const courts = recommendedCourtsPerRound(8);
  assert.equal(courts, 2);
  const rows = buildAmericanoRoundRobinMatchRows('t8', ids(8), 1, 1);
  const total = americanoTotalRounds(8, 2, 1);
  assert.equal(benchCountPerRound(8, 1), 0);
  assert.equal(rows.length, total * 2);
  for (let rn = 1; rn <= total; rn += 1) assertValidRound(rows, rn, 8, 2);
});

test('Americano: 9 spillere = 2 baner, 1 på bænk', () => {
  assert.equal(recommendedCourtsPerRound(9), 2);
  const rows = buildAmericanoRoundRobinMatchRows('t9', ids(9), 2, 1);
  assert.equal(benchCountPerRound(9, 2), 1);
  const total = americanoTotalRounds(9, 2, 1);
  for (let rn = 1; rn <= total; rn += 1) assertValidRound(rows, rn, 9, 2);
});

test('Americano: 14 spillere 3 baner + Lang (×2)', () => {
  assert.equal(recommendedCourtsPerRound(14), 3);
  const rows = buildAmericanoRoundRobinMatchRows('t14', ids(14), 3, 2);
  const total = americanoTotalRounds(14, 3, 2);
  assert.equal(rows.length, total * 3);
  assert.equal(benchCountPerRound(14, 3), 2);
  for (let rn = 1; rn <= total; rn += 1) assertValidRound(rows, rn, 14, 3);
});

test('Americano: hver spiller har samme antal kampe (lige pauses)', () => {
  for (const n of [4, 5, 6, 7, 8, 10, 12, 16]) {
    const courts = recommendedCourtsPerRound(n);
    const rows = buildAmericanoRoundRobinMatchRows('fair', ids(n), courts, 1);
    const play = Object.fromEntries(ids(n).map((id) => [id, 0]));
    for (const m of rows) {
      for (const id of [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]) play[id] += 1;
    }
    const vals = Object.values(play);
    assert.equal(Math.min(...vals), Math.max(...vals), `${n}p: ulige antal kampe`);
  }
});

// ── Mexicano: fulde turneringer simuleret ────────────────────────────────────

function simulateMexicanoTournament(n, courts, passes = 1) {
  const participantIds = ids(n);
  const totalRounds = getMexicanoTotalRounds(n, passes);
  const expectedCourts = Math.min(courts, maxCourts(n));
  const tournament = {
    id: `mx-${n}-${courts}-${passes}`,
    format: 'mexicano',
    opponent_passes: passes,
    courts_per_round: courts,
  };

  let all = [];
  const round1 = buildMexicanoRoundMatches({
    tournamentId: tournament.id,
    roundNumber: 1,
    participantIdsInJoinOrder: participantIds,
    priorMatches: [],
    pointsPerMatch: P,
    totalRounds,
    courtsPerRound: courts,
  });
  assert.equal(round1.length, expectedCourts);
  assertValidRound(round1, 1, n, expectedCourts);
  all = all.concat(lockRound(round1, 1));

  for (let rn = 1; rn < totalRounds; rn += 1) {
    assert.equal(isRoundComplete(all, rn), true);
    const next = buildNextMexicanoRoundIfReady(tournament, participantIds, all, P);
    assert.ok(Array.isArray(next), `forventede runde ${rn + 1}`);
    assert.equal(next.length, expectedCourts);
    assertValidRound(next, rn + 1, n, expectedCourts);
    all = all.concat(lockRound(next, rn + 1));
  }

  assert.equal(buildNextMexicanoRoundIfReady(tournament, participantIds, all, P), null);
  assert.equal(isRoundComplete(all, totalRounds), true);

  const appearances = Object.fromEntries(participantIds.map((id) => [id, 0]));
  for (const m of all) {
    for (const id of [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]) {
      appearances[id] += 1;
    }
  }
  const vals = Object.values(appearances);
  const minA = Math.min(...vals);
  const maxA = Math.max(...vals);
  assert.ok(maxA - minA <= 1, `appearances unfair for ${n}p/${courts}c: ${minA}-${maxA}`);

  return { totalRounds, matches: all.length, appearances };
}

test('Mexicano matrix: 1..floor(n/4) baner for udvalgte n + fulde turneringer', () => {
  const failures = [];
  for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    for (let courts = 1; courts <= maxCourts(n); courts += 1) {
      try {
        simulateMexicanoTournament(n, courts, 1);
      } catch (err) {
        failures.push(`${n}p/${courts}c: ${err.message || err}`);
      }
    }
  }
  // Lang for et par size'r
  for (const [n, courts] of [[6, 1], [8, 2], [12, 3]]) {
    try {
      simulateMexicanoTournament(n, courts, 2);
    } catch (err) {
      failures.push(`${n}p/${courts}c/Lang: ${err.message || err}`);
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 15).join('\n'));
});

test('Mexicano: for mange baner klippes til floor(n/4)', () => {
  const { matches, totalRounds } = simulateMexicanoTournament(8, 99, 1);
  assert.equal(totalRounds, 7);
  assert.equal(matches, 7 * 2);
});
