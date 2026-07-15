/**
 * Matrix for liga-kampsystemer: round robin, Swiss (via dispatcher), knockout.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInitialLeagueMatches,
  buildNextLeagueRound,
  divisionGroupsFromTeams,
  generateKnockoutNextRound,
  generateKnockoutRound1,
  generateRoundRobinRounds,
  knockoutTotalRounds,
  nextPowerOfTwo,
  resolveLigaMatchSystem,
  swissTotalRounds,
} from '../../src/lib/ligaSchedule.js';

function makeTeams(n, { division = 1, eloStart = 2000 } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Hold ${i + 1}`,
    elo_combined: eloStart - i * 50,
    division,
  }));
}

function pairKey(a, b) {
  return [a, b].filter(Boolean).sort().join('|');
}

function teamsInRound(pairings) {
  const seen = new Set();
  for (const p of pairings) {
    if (p.team1_id) {
      assert.equal(seen.has(p.team1_id), false, `dobbelt brug ${p.team1_id}`);
      seen.add(p.team1_id);
    }
    if (p.team2_id) {
      assert.equal(seen.has(p.team2_id), false, `dobbelt brug ${p.team2_id}`);
      seen.add(p.team2_id);
    }
  }
  return seen;
}

// ── resolve / labels ────────────────────────────────────────────────────────

test('resolveLigaMatchSystem: eksplicit + legacy default swiss', () => {
  assert.equal(resolveLigaMatchSystem({ match_system: 'round_robin' }), 'round_robin');
  assert.equal(resolveLigaMatchSystem({ match_system: 'swiss' }), 'swiss');
  assert.equal(resolveLigaMatchSystem({ match_system: 'knockout' }), 'knockout');
  assert.equal(resolveLigaMatchSystem({}), 'swiss');
  assert.equal(resolveLigaMatchSystem({ match_system: null }), 'swiss');
  assert.equal(resolveLigaMatchSystem({ match_system: '' }), 'swiss');
});

// ── Round robin ─────────────────────────────────────────────────────────────

test('RR circle: n=4..12 — ét møde pr. par, én kamp pr. hold pr. runde, bye ved ulige n', () => {
  for (let n = 4; n <= 12; n += 1) {
    const ids = Array.from({ length: n }, (_, i) => `t${i + 1}`);
    const { rounds, totalRounds } = generateRoundRobinRounds(ids);
    const expectedRounds = n % 2 === 0 ? n - 1 : n;
    assert.equal(totalRounds, expectedRounds, `n=${n} totalRounds`);
    assert.equal(rounds.length, expectedRounds, `n=${n} rounds.length`);

    const seenPairs = new Set();
    for (let r = 0; r < rounds.length; r += 1) {
      const pairings = rounds[r];
      const inRound = teamsInRound(pairings);
      assert.equal(inRound.size, n, `n=${n} runde ${r + 1}: alle hold`);

      const byes = pairings.filter((p) => !p.team2_id);
      if (n % 2 === 1) {
        assert.equal(byes.length, 1, `n=${n} runde ${r + 1}: én bye`);
      } else {
        assert.equal(byes.length, 0, `n=${n} runde ${r + 1}: ingen bye`);
      }

      for (const p of pairings) {
        if (!p.team2_id) continue;
        const key = pairKey(p.team1_id, p.team2_id);
        assert.equal(seenPairs.has(key), false, `n=${n} gentaget par ${key}`);
        seenPairs.add(key);
      }
    }

    const expectedPairs = (n * (n - 1)) / 2;
    assert.equal(seenPairs.size, expectedPairs, `n=${n} antal unikke par`);
  }
});

// ── Knockout ────────────────────────────────────────────────────────────────

test('KO runde 1: byes til power-of-2 og kun top seeds', () => {
  for (const n of [4, 5, 6, 7, 8, 9, 16]) {
    const seeds = Array.from({ length: n }, (_, i) => `s${i + 1}`);
    const pairs = generateKnockoutRound1(seeds);
    const bracket = nextPowerOfTwo(n);
    const byeCount = bracket - n;
    const byes = pairs.filter((p) => !p.team2_id);
    assert.equal(byes.length, byeCount, `n=${n} bye-count`);
    for (let i = 0; i < byeCount; i += 1) {
      assert.equal(byes[i].team1_id, seeds[i], `n=${n} bye seed ${i + 1}`);
    }
    const playing = teamsInRound(pairs);
    assert.equal(playing.size, n, `n=${n} alle seeds i runde 1`);
    assert.equal(knockoutTotalRounds(n), Math.ceil(Math.log2(n)));
  }
});

test('KO next: kun vindere, finalist → done via dispatcher', () => {
  const teams = makeTeams(5);
  const league = { id: 'L1', match_system: 'knockout', current_round: 1, total_rounds: knockoutTotalRounds(5) };
  const { rows, totalRounds } = buildInitialLeagueMatches({
    league,
    teamsByDivision: [[1, teams]],
  });
  assert.equal(totalRounds, 3);
  assert.ok(rows.some((r) => !r.team2_id));

  // Simulér: højere seed (lavere index / højere elo) vinder alle pending.
  const reported = rows.map((m, idx) => {
    if (!m.team2_id) return { ...m, id: `m${idx}`, winner_id: m.team1_id, status: 'reported' };
    const t1 = teams.find((t) => t.id === m.team1_id);
    const t2 = teams.find((t) => t.id === m.team2_id);
    const winner = t1.elo_combined >= t2.elo_combined ? t1.id : t2.id;
    return { ...m, id: `m${idx}`, winner_id: winner, status: 'reported' };
  });

  const r2 = buildNextLeagueRound({
    league: { ...league, current_round: 1 },
    teamsByDivision: [[1, teams]],
    allMatches: reported,
  });
  assert.ok(r2.rows?.length);
  assert.ok(r2.rows.every((r) => r.round_number === 2));

  const winnersR1 = reported.map((m) => m.winner_id).filter(Boolean);
  for (const row of r2.rows) {
    assert.ok(winnersR1.includes(row.team1_id));
    if (row.team2_id) assert.ok(winnersR1.includes(row.team2_id));
  }

  // Næste: sæt vindere, kør til finalen og champion.
  let matches = [...reported, ...r2.rows.map((m, i) => {
    if (!m.team2_id) return { ...m, id: `r2-${i}`, winner_id: m.team1_id, status: 'reported' };
    const t1 = teams.find((t) => t.id === m.team1_id);
    const t2 = teams.find((t) => t.id === m.team2_id);
    const winner = t1.elo_combined >= t2.elo_combined ? t1.id : t2.id;
    return { ...m, id: `r2-${i}`, winner_id: winner, status: 'reported' };
  })];

  const r3 = buildNextLeagueRound({
    league: { ...league, current_round: 2 },
    teamsByDivision: [[1, teams]],
    allMatches: matches,
  });
  assert.ok(r3.rows?.length === 1 || r3.done);
  if (r3.rows?.length) {
    matches = [
      ...matches,
      ...r3.rows.map((m, i) => {
        if (!m.team2_id) return { ...m, id: `r3-${i}`, winner_id: m.team1_id, status: 'reported' };
        const t1 = teams.find((t) => t.id === m.team1_id);
        const t2 = teams.find((t) => t.id === m.team2_id);
        const winner = t1.elo_combined >= t2.elo_combined ? t1.id : t2.id;
        return { ...m, id: `r3-${i}`, winner_id: winner, status: 'reported' };
      }),
    ];
    const afterFinal = buildNextLeagueRound({
      league: { ...league, current_round: 3, total_rounds: 3 },
      teamsByDivision: [[1, teams]],
      allMatches: matches,
    });
    assert.equal(afterFinal.done, true);
    assert.ok(['champion', 'all_rounds_played'].includes(afterFinal.reason));
  }

  // generateKnockoutNextRound med 1 vinder → tom
  assert.deepEqual(generateKnockoutNextRound([{ winner_id: 't1' }]), []);
});

// ── Swiss via dispatcher ────────────────────────────────────────────────────

test('Swiss dispatcher: runde 1 + næste uden rematch', () => {
  const teams = makeTeams(6);
  const league = { id: 'Ls', match_system: 'swiss', current_round: 1 };
  const { rows, totalRounds } = buildInitialLeagueMatches({
    league,
    teamsByDivision: [[1, teams]],
  });
  assert.equal(totalRounds, swissTotalRounds(6));
  assert.ok(rows.length >= 3);
  assert.ok(rows.every((r) => r.round_number === 1));

  const reported = rows.map((m, i) => {
    if (!m.team2_id) return { ...m, id: `s${i}`, winner_id: m.team1_id, status: 'reported' };
    return { ...m, id: `s${i}`, winner_id: m.team1_id, status: 'reported', score_text: '6-3' };
  });

  const next = buildNextLeagueRound({
    league: { ...league, total_rounds: totalRounds },
    teamsByDivision: [[1, teams]],
    allMatches: reported,
  });
  assert.ok(next.rows?.length);
  const played = new Set(
    reported.filter((m) => m.team2_id).map((m) => pairKey(m.team1_id, m.team2_id)),
  );
  for (const p of next.rows) {
    if (!p.team2_id) continue;
    assert.equal(played.has(pairKey(p.team1_id, p.team2_id)), false, 'ingen rematch');
  }
});

// ── RR / KO buildInitial + buildNext ────────────────────────────────────────

test('RR dispatcher: alle runder ved start; nextRound = advanceOnly', () => {
  const teams = makeTeams(4);
  const league = { id: 'Lr', match_system: 'round_robin', current_round: 1 };
  const { rows, totalRounds } = buildInitialLeagueMatches({
    league,
    teamsByDivision: [[1, teams]],
  });
  assert.equal(totalRounds, 3);
  assert.equal(new Set(rows.map((r) => r.round_number)).size, 3);

  const advance = buildNextLeagueRound({
    league: { ...league, total_rounds: totalRounds },
    teamsByDivision: [[1, teams]],
    allMatches: rows,
  });
  assert.equal(advance.advanceOnly, true);
  assert.deepEqual(advance.rows, []);

  const exhausted = buildNextLeagueRound({
    league: { ...league, current_round: 3, total_rounds: 3 },
    teamsByDivision: [[1, teams]],
    allMatches: rows,
  });
  assert.equal(exhausted.done, true);
  assert.equal(exhausted.reason, 'all_rounds_played');
});

// ── Divisioner ──────────────────────────────────────────────────────────────

test('Divisioner: 8 hold / 2 div — ingen cross-pairs', () => {
  const d1 = makeTeams(4, { division: 1, eloStart: 2200 });
  const d2 = makeTeams(4, { division: 2, eloStart: 1800 }).map((t, i) => ({
    ...t,
    id: `d2t${i + 1}`,
  }));
  const teams = [...d1, ...d2];
  const groups = divisionGroupsFromTeams(teams, 2);
  assert.equal(groups.length, 2);

  for (const system of ['round_robin', 'swiss', 'knockout']) {
    const league = { id: `Ld-${system}`, match_system: system };
    const { rows } = buildInitialLeagueMatches({ league, teamsByDivision: groups });
    assert.ok(rows.length > 0, system);
    for (const m of rows) {
      if (!m.team2_id) continue;
      const t1 = teams.find((t) => t.id === m.team1_id);
      const t2 = teams.find((t) => t.id === m.team2_id);
      assert.equal(t1.division, t2.division, `${system}: cross-div ${m.team1_id} vs ${m.team2_id}`);
    }
  }
});
