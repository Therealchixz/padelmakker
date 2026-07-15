/**
 * Matematisk/kodningsmæssig matrix for Liga: standings, Swiss-parring, divisioner, scores.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignDivisionsByElo,
  computeStandings,
  generatePairings,
  groupByDivision,
  isTiebreakScore,
  parseGameDiff,
  validatePadelScore,
} from '../../src/lib/ligaStandings.js';

function makeTeams(n, eloStart = 2000) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Hold ${i + 1}`,
    elo_combined: eloStart - i * 50,
    division: 1,
  }));
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function reported(team1Id, team2Id, winnerId, scoreText) {
  return {
    team1_id: team1Id,
    team2_id: team2Id,
    winner_id: winnerId,
    score_text: scoreText,
    status: 'reported',
  };
}

function simulateSeason(n, rounds, { score = '6-3', pointsWin = 3, pointsDraw = 1, pointsLoss = 0 } = {}) {
  const teams = makeTeams(n);
  let matches = [];
  for (let r = 0; r < rounds; r += 1) {
    const standings = computeStandings(teams, matches, { pointsWin, pointsDraw, pointsLoss });
    const pairings = generatePairings(standings, matches);
    for (const p of pairings) {
      if (!p.team2_id) continue;
      // Højere elo vinder deterministisk.
      const t1 = teams.find((t) => t.id === p.team1_id);
      const t2 = teams.find((t) => t.id === p.team2_id);
      const winnerId = (t1.elo_combined >= t2.elo_combined) ? t1.id : t2.id;
      matches.push(reported(p.team1_id, p.team2_id, winnerId, score));
    }
  }
  return { teams, matches, standings: computeStandings(teams, matches, { pointsWin, pointsDraw, pointsLoss }) };
}

// ── Score helpers ───────────────────────────────────────────────────────────

test('isTiebreakScore og validatePadelScore grid', () => {
  assert.equal(isTiebreakScore('7-6'), true);
  assert.equal(isTiebreakScore('6-7'), true);
  assert.equal(isTiebreakScore('6-4'), false);
  assert.equal(isTiebreakScore('7-5'), false);

  const valid = ['6-0', '6-1', '6-2', '6-3', '6-4', '7-5', '7-6', '0-6', '4-6', '5-7', '6-7'];
  for (const s of valid) assert.equal(validatePadelScore(s), null, s);

  const invalid = ['', '6-5', '5-5', '8-6', '4-4', '6:4', '7-4', '9-7', 'abc'];
  for (const s of invalid) assert.ok(validatePadelScore(s), `forventede fejl for ${s}`);
});

test('parseGameDiff er symmetrisk ift. vinder', () => {
  assert.equal(parseGameDiff('6-4', 't1', 't1'), 2);
  assert.equal(parseGameDiff('6-4', 't2', 't1'), -2);
  assert.equal(parseGameDiff('7-6', 't1', 't1'), 1);
  assert.equal(parseGameDiff('bad', 't1', 't1'), 0);
});

// ── Standings ───────────────────────────────────────────────────────────────

test('computeStandings: win/loss point og gameDiff', () => {
  const teams = makeTeams(4);
  const matches = [
    reported('t1', 't2', 't1', '6-3'),
    reported('t3', 't4', 't3', '6-4'),
  ];
  const s = computeStandings(teams, matches);
  const byId = Object.fromEntries(s.map((row) => [row.id, row]));
  assert.equal(byId.t1.points, 3);
  assert.equal(byId.t1.wins, 1);
  assert.equal(byId.t1.gameDiff, 3);
  assert.equal(byId.t2.points, 0);
  assert.equal(byId.t2.losses, 1);
  assert.equal(byId.t2.gameDiff, -3);
  assert.equal(byId.t3.gameDiff, 2);
  assert.equal(byId.t4.gameDiff, -2);
  assert.equal(s[0].id, 't1'); // samme points som t3, men større gameDiff
});

test('computeStandings: 7-6 giver loser pointsDraw (ikke 0)', () => {
  const teams = makeTeams(2);
  const matches = [reported('t1', 't2', 't1', '7-6')];
  const s = computeStandings(teams, matches, { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 });
  const byId = Object.fromEntries(s.map((row) => [row.id, row]));
  assert.equal(byId.t1.points, 3);
  assert.equal(byId.t2.points, 1);
  assert.equal(byId.t2.losses, 1);
});

test('computeStandings: custom pointtal og sort-tiebreakers', () => {
  const teams = [
    { id: 'a', elo_combined: 100 },
    { id: 'b', elo_combined: 300 },
    { id: 'c', elo_combined: 200 },
  ];
  const matches = [
    reported('a', 'b', 'a', '6-4'), // a +2 diff, b -2
    reported('a', 'c', 'c', '6-2'), // c +4, a -4 → a ends 2-(-4)=-2? wait a first match +2 then -4 = -2
  ];
  // After: a: 3pts, 1W1L, gd=-2; c: 3pts 1W, gd=+4; b: 0pts
  const s = computeStandings(teams, matches, { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 });
  assert.equal(s[0].id, 'c');
  assert.equal(s[1].id, 'a');
  assert.equal(s[2].id, 'b');
});

// ── Pairings (Swiss-style) ──────────────────────────────────────────────────

test('generatePairings: lige antal → ingen bye, ingen overlap', () => {
  for (const n of [4, 6, 8, 10, 12, 16]) {
    const teams = makeTeams(n);
    const standings = computeStandings(teams, []);
    const pairings = generatePairings(standings, []);
    const real = pairings.filter((p) => p.team2_id);
    const byes = pairings.filter((p) => !p.team2_id);
    assert.equal(byes.length, 0, `${n}: ingen bye`);
    assert.equal(real.length, n / 2);
    const used = new Set();
    for (const p of real) {
      assert.notEqual(p.team1_id, p.team2_id);
      assert.ok(!used.has(p.team1_id));
      assert.ok(!used.has(p.team2_id));
      used.add(p.team1_id);
      used.add(p.team2_id);
    }
    assert.equal(used.size, n);
  }
});

test('generatePairings: ulige antal → præcis én bye', () => {
  for (const n of [3, 5, 7, 9, 11]) {
    const teams = makeTeams(n);
    const standings = computeStandings(teams, []);
    const pairings = generatePairings(standings, []);
    const byes = pairings.filter((p) => !p.team2_id);
    assert.equal(byes.length, 1, `${n}: én bye`);
    assert.equal(pairings.filter((p) => p.team2_id).length, Math.floor(n / 2));
  }
});

test('generatePairings: ingen rematch før nødvendigt', () => {
  const { teams, matches } = simulateSeason(6, 1);
  const standings = computeStandings(teams, matches);
  const next = generatePairings(standings, matches);
  const played = new Set(matches.map((m) => pairKey(m.team1_id, m.team2_id)));
  for (const p of next.filter((x) => x.team2_id)) {
    assert.ok(!played.has(pairKey(p.team1_id, p.team2_id)), 'rematch i runde 2');
  }
});

test('generatePairings multi-runde: alle n=4..12 over flere runder uden overlap i samme runde', () => {
  const failures = [];
  for (const n of [4, 5, 6, 7, 8, 9, 10, 12]) {
    try {
      const rounds = Math.min(5, n - 1);
      const { matches, standings } = simulateSeason(n, rounds);
      assert.ok(standings.length === n);
      // hvert hold spillede mindst ét (n>1)
      for (const row of standings) {
        assert.ok(row.played >= 1 || n === 1);
        assert.ok(row.played <= rounds);
      }
      // point-sum: hver reelle kamp giver win+loss = pointsWin + (tb? draw : loss)
      const realMatches = matches.filter((m) => m.team2_id && m.status === 'reported');
      const sumPoints = standings.reduce((acc, r) => acc + r.points, 0);
      assert.equal(sumPoints, realMatches.length * (3 + 0)); // score 6-3 → ikke TB
      // alle kampnøgler unikke
      const keys = realMatches.map((m) => pairKey(m.team1_id, m.team2_id));
      assert.equal(new Set(keys).size, keys.length, `${n}: rematch i sæson`);
    } catch (err) {
      failures.push(`${n}: ${err.message || err}`);
    }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
});

// ── Divisions ───────────────────────────────────────────────────────────────

test('assignDivisionsByElo: størrelser afviger maks 1, stærkest i div 1', () => {
  for (const [n, divs] of [[8, 2], [12, 3], [12, 4], [5, 2], [7, 3], [10, 4], [16, 4]]) {
    const teams = makeTeams(n);
    const map = assignDivisionsByElo(teams, divs);
    assert.equal(map.size, n);
    const counts = {};
    for (const d of map.values()) counts[d] = (counts[d] || 0) + 1;
    const sizes = Object.values(counts);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${n}/${divs} sizes`);
    // stærkeste hold i div 1
    assert.equal(map.get('t1'), 1);
  }
});

test('groupByDivision + Swiss inden for division', () => {
  const teams = makeTeams(8).map((t) => ({ ...t }));
  const divMap = assignDivisionsByElo(teams, 2);
  for (const t of teams) t.division = divMap.get(t.id);
  const groups = groupByDivision(teams);
  assert.equal(groups.length, 2);
  for (const [, rows] of groups) {
    const standings = computeStandings(rows, []);
    const pairings = generatePairings(standings, []);
    for (const p of pairings.filter((x) => x.team2_id)) {
      const d1 = divMap.get(p.team1_id);
      const d2 = divMap.get(p.team2_id);
      assert.equal(d1, d2, 'ingen cross-division pairing');
    }
  }
});
