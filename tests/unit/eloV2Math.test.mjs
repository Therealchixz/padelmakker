import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculate2v2EloChanges,
  eloV2ExpectedScore,
  eloV2KFactor,
  eloV2MarginMultiplier,
} from '../../src/lib/eloV2Math.js';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function players2v2(opts = {}) {
  const t1 = opts.team1 || [1000, 1000];
  const t2 = opts.team2 || [1000, 1000];
  const games = opts.gamesPlayed || [50, 50, 50, 50];
  return [
    { userId: 'A1', team: 1, rating: t1[0], gamesPlayed: games[0] },
    { userId: 'A2', team: 1, rating: t1[1], gamesPlayed: games[1] },
    { userId: 'B1', team: 2, rating: t2[0], gamesPlayed: games[2] },
    { userId: 'B2', team: 2, rating: t2[1], gamesPlayed: games[3] },
  ];
}

function totalDelta(rows) {
  return rows.reduce((s, r) => s + r.delta, 0);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Building blocks                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

test('eloV2ExpectedScore is 0.5 for equal ratings and symmetric around it', () => {
  assert.equal(eloV2ExpectedScore(1000, 1000), 0.5);
  const a = eloV2ExpectedScore(1200, 1000);
  const b = eloV2ExpectedScore(1000, 1200);
  assert.ok(Math.abs(a + b - 1) < 1e-9);
  assert.ok(a > 0.5);
  assert.ok(b < 0.5);
});

test('eloV2KFactor follows the three-tier rookie/regular/veteran rule', () => {
  assert.equal(eloV2KFactor(0), 56);
  assert.equal(eloV2KFactor(9), 56);
  assert.equal(eloV2KFactor(10), 44);
  assert.equal(eloV2KFactor(29), 44);
  assert.equal(eloV2KFactor(30), 32);
  assert.equal(eloV2KFactor(500), 32);
});

test('eloV2MarginMultiplier scales with parti-difference', () => {
  assert.equal(eloV2MarginMultiplier(6, 6), 1.0);
  assert.equal(eloV2MarginMultiplier(6, 2), 1.0); /* margin 4 ⇒ stadig 1.0 */
  assert.equal(eloV2MarginMultiplier(6, 1), 1.2); /* margin 5 ⇒ 1.2 */
  assert.equal(eloV2MarginMultiplier(12, 3), 1.2); /* margin 9 ⇒ 1.2 */
  assert.equal(eloV2MarginMultiplier(12, 2), 1.4); /* margin 10 ⇒ 1.4 */
  assert.equal(eloV2MarginMultiplier(18, 4), 1.4); /* margin 14 ⇒ 1.4 */
  assert.equal(eloV2MarginMultiplier(18, 3), 1.6); /* margin 15 ⇒ 1.6 */
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Invariants — zero-sum                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

test('total delta sums to exactly 0 for equal teams (no rating cap)', () => {
  const rows = calculate2v2EloChanges({
    players: players2v2(),
    winner: 'team1',
    team1Games: 12,
    team2Games: 8,
  });
  assert.equal(totalDelta(rows), 0);
});

test('total delta is 0 across many rating spreads', () => {
  const cases = [
    { team1: [1500, 1500], team2: [800, 800] },
    { team1: [1500, 800], team2: [1200, 1100] },
    { team1: [1100, 1100], team2: [900, 900] },
    { team1: [1800, 600], team2: [1000, 1000] },
  ];
  for (const c of cases) {
    for (const winner of ['team1', 'team2']) {
      const rows = calculate2v2EloChanges({
        players: players2v2(c),
        winner,
        team1Games: 12,
        team2Games: 6,
      });
      assert.equal(
        totalDelta(rows),
        0,
        `zero-sum brudt for ${JSON.stringify(c)} winner=${winner}`,
      );
    }
  }
});

test('total delta sums to 0 for blowout (margin > 14)', () => {
  const rows = calculate2v2EloChanges({
    players: players2v2(),
    winner: 'team1',
    team1Games: 18,
    team2Games: 2, /* margin 16 */
  });
  assert.equal(totalDelta(rows), 0);
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Monotonicity                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

test('winning team gains and losing team loses ELO', () => {
  const rows = calculate2v2EloChanges({
    players: players2v2(),
    winner: 'team1',
    team1Games: 12,
    team2Games: 8,
  });
  const t1 = rows.filter((r) => r.team === 1);
  const t2 = rows.filter((r) => r.team === 2);
  for (const r of t1) assert.ok(r.delta > 0, `Hold 1 spiller ${r.userId} skulle vinde ELO (delta=${r.delta})`);
  for (const r of t2) assert.ok(r.delta < 0, `Hold 2 spiller ${r.userId} skulle tabe ELO (delta=${r.delta})`);
});

test('underdog upset gives bigger ELO swing than favorite winning', () => {
  /* Favorit-sejr (1200 vs 1000): hold 1 vinder */
  const favWin = calculate2v2EloChanges({
    players: players2v2({ team1: [1200, 1200], team2: [1000, 1000] }),
    winner: 'team1',
    team1Games: 12,
    team2Games: 8,
  });
  const favGain = favWin.find((r) => r.team === 1).delta;

  /* Upset (1000 vs 1200): hold 1 (underdog) vinder */
  const upset = calculate2v2EloChanges({
    players: players2v2({ team1: [1000, 1000], team2: [1200, 1200] }),
    winner: 'team1',
    team1Games: 12,
    team2Games: 8,
  });
  const upsetGain = upset.find((r) => r.team === 1).delta;

  assert.ok(upsetGain > favGain, `upset (${upsetGain}) skulle give mere end favorit-sejr (${favGain})`);
});

test('bigger parti-margin gives bigger ELO swing for the same matchup', () => {
  const close = calculate2v2EloChanges({
    players: players2v2(),
    winner: 'team1',
    team1Games: 6,
    team2Games: 5, /* margin 1 → mult 1.0 */
  });
  const blowout = calculate2v2EloChanges({
    players: players2v2(),
    winner: 'team1',
    team1Games: 18,
    team2Games: 2, /* margin 16 → mult 1.6 */
  });
  const closeWin = close.find((r) => r.team === 1).delta;
  const blowoutWin = blowout.find((r) => r.team === 1).delta;
  assert.ok(blowoutWin > closeWin, `blowout (${blowoutWin}) skulle give mere end tæt sejr (${closeWin})`);
});

test('rookie K-factor (56) gives bigger swing than veteran (32)', () => {
  const rookie = calculate2v2EloChanges({
    players: players2v2({ gamesPlayed: [5, 5, 5, 5] }),
    winner: 'team1',
    team1Games: 12,
    team2Games: 8,
  });
  const veteran = calculate2v2EloChanges({
    players: players2v2({ gamesPlayed: [100, 100, 100, 100] }),
    winner: 'team1',
    team1Games: 12,
    team2Games: 8,
  });
  const rookieGain = rookie.find((r) => r.team === 1).delta;
  const veteranGain = veteran.find((r) => r.team === 1).delta;
  assert.ok(rookieGain > veteranGain, `rookie (${rookieGain}) skulle få mere end veteran (${veteranGain})`);
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rating floor (100)                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

test('new rating cannot drop below 100 even on a loss', () => {
  const rows = calculate2v2EloChanges({
    players: players2v2({
      team1: [1800, 1800],
      team2: [105, 110], /* lige over loftet */
      gamesPlayed: [5, 5, 5, 5],
    }),
    winner: 'team1',
    team1Games: 18,
    team2Games: 0,
  });
  for (const r of rows) {
    assert.ok(r.newRating >= 100, `${r.userId} faldt under 100: ${r.newRating}`);
  }
});

test('rating cap may break zero-sum but every rating stays valid', () => {
  const rows = calculate2v2EloChanges({
    players: players2v2({
      team1: [1800, 1800],
      team2: [100, 100], /* allerede på loftet */
      gamesPlayed: [5, 5, 5, 5],
    }),
    winner: 'team1',
    team1Games: 18,
    team2Games: 0,
  });
  /* Loser-holdet kan ikke tabe yderligere → vinder-holdet får ikke fuld gevinst.
     Vi tjekker derfor IKKE zero-sum her, men at ratingen er gyldig. */
  for (const r of rows) {
    assert.ok(r.newRating >= 100);
    assert.equal(r.oldRating + r.delta, r.newRating);
  }
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Edge cases                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

test('throws for wrong player count', () => {
  assert.throws(() => calculate2v2EloChanges({
    players: [
      { userId: 'A', team: 1, rating: 1000, gamesPlayed: 0 },
      { userId: 'B', team: 2, rating: 1000, gamesPlayed: 0 },
    ],
    winner: 'team1',
    team1Games: 6,
    team2Games: 0,
  }), /præcis 4 spillere/);
});

test('throws for duplicate userIds', () => {
  assert.throws(() => calculate2v2EloChanges({
    players: [
      { userId: 'A', team: 1, rating: 1000, gamesPlayed: 0 },
      { userId: 'A', team: 1, rating: 1000, gamesPlayed: 0 },
      { userId: 'C', team: 2, rating: 1000, gamesPlayed: 0 },
      { userId: 'D', team: 2, rating: 1000, gamesPlayed: 0 },
    ],
    winner: 'team1',
    team1Games: 6,
    team2Games: 0,
  }), /unikke/);
});

test('throws for unbalanced teams (3 vs 1)', () => {
  assert.throws(() => calculate2v2EloChanges({
    players: [
      { userId: 'A', team: 1, rating: 1000, gamesPlayed: 0 },
      { userId: 'B', team: 1, rating: 1000, gamesPlayed: 0 },
      { userId: 'C', team: 1, rating: 1000, gamesPlayed: 0 },
      { userId: 'D', team: 2, rating: 1000, gamesPlayed: 0 },
    ],
    winner: 'team1',
    team1Games: 6,
    team2Games: 0,
  }), /2 spillere pr\. hold/);
});

test('newRating = oldRating + delta for every player (no off-by-one)', () => {
  const rows = calculate2v2EloChanges({
    players: players2v2({ team1: [1234, 987], team2: [1100, 1050] }),
    winner: 'team2',
    team1Games: 9,
    team2Games: 12,
  });
  for (const r of rows) {
    assert.equal(r.newRating, Math.max(100, r.oldRating + r.delta));
  }
});
