/**
 * Matematisk/kodningsmæssig matrix for 2v2: ELO, resultat-validering, roster, win prediction.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculate2v2EloChanges,
  eloV2ExpectedScore,
  eloV2KFactor,
  eloV2MarginMultiplier,
  roundHalfAwayFromZero,
} from '../../src/lib/eloV2Math.js';
import {
  validateMatchRosterForElo,
  validateSubmittedPadelResult,
} from '../../src/lib/padelResultGuards.js';
import {
  calculate2v2MatchWinPrediction,
  formatWinPredictionPct,
} from '../../src/lib/matchWinPrediction.js';
import { formatSubmittedPadelScore } from '../../src/lib/matchResultScore.js';
import { buildMatchResultInsertPayload } from '../../src/lib/matchResultPayload.js';

function fourPlayers(ratings, gamesPlayed = [20, 20, 20, 20]) {
  return [
    { userId: 'a', team: 1, rating: ratings[0], gamesPlayed: gamesPlayed[0] },
    { userId: 'b', team: 1, rating: ratings[1], gamesPlayed: gamesPlayed[1] },
    { userId: 'c', team: 2, rating: ratings[2], gamesPlayed: gamesPlayed[2] },
    { userId: 'd', team: 2, rating: ratings[3], gamesPlayed: gamesPlayed[3] },
  ];
}

function sumDelta(rows) {
  return rows.reduce((acc, r) => acc + r.delta, 0);
}

// ── ELO helpers ─────────────────────────────────────────────────────────────

test('roundHalfAwayFromZero og K/margin helpers', () => {
  assert.equal(roundHalfAwayFromZero(1.5), 2);
  assert.equal(roundHalfAwayFromZero(-1.5), -2);
  assert.equal(eloV2KFactor(0), 56);
  assert.equal(eloV2KFactor(9), 56);
  assert.equal(eloV2KFactor(10), 44);
  assert.equal(eloV2KFactor(29), 44);
  assert.equal(eloV2KFactor(30), 32);
  assert.equal(eloV2MarginMultiplier(6, 4), 1.0); // margin 2
  assert.equal(eloV2MarginMultiplier(10, 5), 1.2); // 5
  assert.equal(eloV2MarginMultiplier(14, 4), 1.4); // 10
  assert.equal(eloV2MarginMultiplier(20, 4), 1.6); // 16
  assert.ok(Math.abs(eloV2ExpectedScore(1000, 1000) - 0.5) < 1e-9);
});

test('ELO matrix: mange rating-/margin-kombinationer holder invarianter', () => {
  const ratingSets = [
    [1000, 1000, 1000, 1000],
    [1200, 1180, 1100, 1080],
    [1500, 800, 1150, 1150],
    [900, 910, 1300, 1310],
    [105, 120, 1400, 1410], // nær floor
  ];
  const margins = [
    [6, 4], // 2
    [6, 1], // 5
    [12, 2], // 10
    [18, 2], // 16
  ];
  const failures = [];
  for (const ratings of ratingSets) {
    for (const [t1g, t2g] of margins) {
      for (const winner of ['team1', 'team2']) {
        try {
          const rows = calculate2v2EloChanges({
            players: fourPlayers(ratings),
            winner,
            team1Games: t1g,
            team2Games: t2g,
          });
          assert.equal(rows.length, 4);
          for (const r of rows) {
            assert.ok(r.newRating >= 100);
            assert.equal(r.newRating, r.oldRating + r.delta);
          }
          const winners = rows.filter((r) =>
            (winner === 'team1' && r.team === 1) || (winner === 'team2' && r.team === 2),
          );
          const losers = rows.filter((r) => !winners.includes(r));
          // Med mindre floor knækker det: vindere typisk >=0, tabere <=0
          if (Math.min(...ratings) > 150) {
            assert.ok(winners.every((r) => r.delta >= 0));
            assert.ok(losers.every((r) => r.delta <= 0));
            assert.equal(sumDelta(rows), 0);
          }
        } catch (err) {
          failures.push(`${ratings}|${t1g}-${t2g}|${winner}: ${err.message || err}`);
        }
      }
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 10).join('\n'));
});

test('ELO: rookies får større swings end veterans', () => {
  const base = {
    winner: 'team1',
    team1Games: 6,
    team2Games: 3,
  };
  const rookie = calculate2v2EloChanges({
    ...base,
    players: fourPlayers([1000, 1000, 1000, 1000], [0, 0, 0, 0]),
  });
  const vet = calculate2v2EloChanges({
    ...base,
    players: fourPlayers([1000, 1000, 1000, 1000], [40, 40, 40, 40]),
  });
  const rSwing = Math.abs(rookie.find((r) => r.userId === 'a').delta);
  const vSwing = Math.abs(vet.find((r) => r.userId === 'a').delta);
  assert.ok(rSwing > vSwing);
});

test('ELO: større margin giver ikke mindre |delta| for samme matchup', () => {
  const players = fourPlayers([1100, 1100, 1000, 1000]);
  const tight = calculate2v2EloChanges({ players, winner: 'team1', team1Games: 6, team2Games: 4 });
  const blowout = calculate2v2EloChanges({ players, winner: 'team1', team1Games: 18, team2Games: 2 });
  assert.ok(Math.abs(blowout[0].delta) >= Math.abs(tight[0].delta));
});

// ── Result validation ───────────────────────────────────────────────────────

test('validateSubmittedPadelResult: gyldige 1-/2-/3-sæt former', () => {
  const okCases = [
    {
      winner: 'team1',
      completed: true,
      sets: [{ gamesTeam1: 6, gamesTeam2: 2 }],
    },
    {
      winner: 'team1',
      completed: true,
      sets: [
        { gamesTeam1: 6, gamesTeam2: 3 },
        { gamesTeam1: 6, gamesTeam2: 4 },
      ],
    },
    {
      winner: 'team2',
      completed: true,
      sets: [
        { gamesTeam1: 6, gamesTeam2: 3 },
        { gamesTeam1: 3, gamesTeam2: 6 },
        { gamesTeam1: 4, gamesTeam2: 6 },
      ],
    },
    {
      winner: 'team1',
      completed: true,
      sets: [{
        gamesTeam1: 7,
        gamesTeam2: 6,
        tiebreakTeam1: 7,
        tiebreakTeam2: 3,
      }],
    },
    {
      winner: 'team2',
      completed: true,
      sets: [{
        gamesTeam1: 6,
        gamesTeam2: 6,
        tiebreakTeam1: 8,
        tiebreakTeam2: 10,
      }],
    },
    {
      winner: 'team1',
      completed: true,
      sets: [{ gamesTeam1: 7, gamesTeam2: 5 }],
    },
  ];
  for (const c of okCases) {
    const r = validateSubmittedPadelResult(c);
    assert.equal(r.ok, true, JSON.stringify(c.sets));
  }
});

test('validateSubmittedPadelResult: afviser ugyldige set/TB/ufærdige', () => {
  const bad = [
    { winner: 'team1', completed: true, sets: [{ gamesTeam1: 6, gamesTeam2: 5 }] },
    { winner: 'team1', completed: true, sets: [{ gamesTeam1: 6, gamesTeam2: 6 }] }, // mangler TB
    {
      winner: 'team1',
      completed: true,
      sets: [{ gamesTeam1: 7, gamesTeam2: 6, tiebreakTeam1: 7, tiebreakTeam2: 6 }], // margin < 2
    },
    {
      winner: 'team1',
      completed: true,
      sets: [{ gamesTeam1: 6, gamesTeam2: 3, tiebreakTeam1: 7, tiebreakTeam2: 2 }], // TB uden 6-6/7-6
    },
    {
      winner: 'team1',
      completed: true,
      sets: [
        { gamesTeam1: 6, gamesTeam2: 3 },
        { gamesTeam1: 3, gamesTeam2: 6 },
      ], // 1-1 uden 3. sæt
    },
    { winner: 'team1', completed: false, sets: [{ gamesTeam1: 6, gamesTeam2: 2 }] },
    { winner: 'team2', completed: true, sets: [{ gamesTeam1: 6, gamesTeam2: 2 }] }, // forkert vinder
  ];
  for (const c of bad) {
    assert.equal(validateSubmittedPadelResult(c).ok, false, JSON.stringify(c));
  }
});

test('validateMatchRosterForElo matrix', () => {
  assert.equal(
    validateMatchRosterForElo([
      { user_id: '1', team: 1 },
      { user_id: '2', team: 1 },
      { user_id: '3', team: 2 },
      { user_id: '4', team: 2 },
    ]).ok,
    true,
  );
  assert.equal(
    validateMatchRosterForElo([
      { user_id: '1', team: 1 },
      { user_id: '2', team: 1 },
      { user_id: '3', team: 2 },
    ]).ok,
    false,
  );
});

// ── Win prediction + score pipeline ─────────────────────────────────────────

test('win prediction: sum 100 og favorit > underdog over ELO-spreads', () => {
  const spreads = [0, 40, 100, 200, 400];
  for (const d of spreads) {
    const pred = calculate2v2MatchWinPrediction(
      [
        { rating: 1000 + d / 2, gamesPlayed: 20 },
        { rating: 1000 + d / 2, gamesPlayed: 20 },
      ],
      [
        { rating: 1000 - d / 2, gamesPlayed: 20 },
        { rating: 1000 - d / 2, gamesPlayed: 20 },
      ],
    );
    assert.ok(pred);
    assert.equal(pred.team1WinPct + pred.team2WinPct, 100);
    if (d === 0) {
      assert.ok(Math.abs(pred.team1WinPct - 50) <= 1);
    } else {
      assert.ok(pred.team1WinPct > pred.team2WinPct);
    }
    assert.ok(formatWinPredictionPct(pred.team1WinPct).includes('%'));
  }
});

test('score payload + display: TB bevarer information', () => {
  const sets = [{
    setNumber: 1,
    gamesTeam1: 7,
    gamesTeam2: 6,
    tiebreakTeam1: 7,
    tiebreakTeam2: 4,
  }];
  const display = formatSubmittedPadelScore(sets);
  assert.match(display, /7-6/);
  assert.match(display, /7-4|TB/i);

  const payload = buildMatchResultInsertPayload({
    matchId: 'm1',
    submittedBy: 'u1',
    players: [
      { user_id: 'a', team: 1 },
      { user_id: 'b', team: 1 },
      { user_id: 'c', team: 2 },
      { user_id: 'd', team: 2 },
    ],
    result: {
      winner: 'team1',
      completed: true,
      sets,
    },
  });
  assert.equal(payload.set1_team1, 7);
  assert.equal(payload.set1_team2, 6);
  assert.equal(payload.set1_tb1, 7);
  assert.equal(payload.set1_tb2, 4);
  assert.match(payload.score_display, /7-6/);
});
