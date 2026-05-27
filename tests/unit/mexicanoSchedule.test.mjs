import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMexicanoRoundMatch,
  buildMexicanoRoundMatches,
  buildNextMexicanoRoundIfReady,
  computeMexicanoStandings,
  getMexicanoTotalRounds,
  isRoundComplete,
  pairMexicanoOnCourt,
  selectMexicanoCourtPlayers,
} from '../../src/lib/mexicanoSchedule.js'

const P = 16
const IDS = ['p0', 'p1', 'p2', 'p3', 'p4']
const IDS4 = ['p0', 'p1', 'p2', 'p3']
const IDS12 = Array.from({ length: 12 }, (_, i) => `p${i}`)

function lockedMatch(round, a1, a2, b1, b2, scoreA, scoreB, courtIndex = 0) {
  return {
    round_number: round,
    court_index: courtIndex,
    team_a_p1: a1,
    team_a_p2: a2,
    team_b_p1: b1,
    team_b_p2: b2,
    team_a_score: scoreA,
    team_b_score: scoreB,
    results_locked: true,
  }
}

// ── getMexicanoTotalRounds ──────────────────────────────────────────────────

test('getMexicanoTotalRounds: 4 spillere → 3 runder', () => {
  assert.equal(getMexicanoTotalRounds(4, 1), 3)
})
test('getMexicanoTotalRounds: 5 spillere → 5 runder', () => {
  assert.equal(getMexicanoTotalRounds(5, 1), 5)
})
test('getMexicanoTotalRounds: 6 spillere x2 passes → 10 runder', () => {
  assert.equal(getMexicanoTotalRounds(6, 2), 10)
})
test('getMexicanoTotalRounds: 16 spillere → 15 runder', () => {
  assert.equal(getMexicanoTotalRounds(16, 1), 15)
})

// ── 4 spillere (ingen bænk) ─────────────────────────────────────────────────

test('4 spillere runde 1: alle fire på banen, ingen bænk', () => {
  const rows = buildMexicanoRoundMatches({
    tournamentId: 't1',
    roundNumber: 1,
    participantIdsInJoinOrder: IDS4,
    priorMatches: [],
    pointsPerMatch: P,
    totalRounds: 3,
    courtsPerRound: 1,
  })
  assert.equal(rows.length, 1, 'skal give 1 kamp')
  const onCourt = [rows[0].team_a_p1, rows[0].team_a_p2, rows[0].team_b_p1, rows[0].team_b_p2].sort()
  assert.deepEqual(onCourt, ['p0', 'p1', 'p2', 'p3'].sort())
})

// ── Legacy buildMexicanoRoundMatch ──────────────────────────────────────────

test('round 1 uses join order for fair first bench (legacy API)', () => {
  const row = buildMexicanoRoundMatch({
    tournamentId: 't1',
    roundNumber: 1,
    participantIdsInJoinOrder: IDS,
    priorMatches: [],
    pointsPerMatch: P,
    totalRounds: 5,
  })
  assert.ok(row)
  assert.deepEqual(
    [row.team_a_p1, row.team_a_p2, row.team_b_p1, row.team_b_p2].sort(),
    ['p0', 'p1', 'p2', 'p3'].sort(),
  )
})

// ── 12 spillere, 3 baner ────────────────────────────────────────────────────

test('12 spillere runde 1 med 3 baner → 3 kampe, ingen spiller overlap', () => {
  const rows = buildMexicanoRoundMatches({
    tournamentId: 't12',
    roundNumber: 1,
    participantIdsInJoinOrder: IDS12,
    priorMatches: [],
    pointsPerMatch: P,
    totalRounds: 11,
    courtsPerRound: 3,
  })
  assert.equal(rows.length, 3, '3 baner → 3 kampe')
  const onCourt = rows.flatMap((r) => [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2])
  assert.equal(new Set(onCourt).size, 12, 'alle 12 spillere er på banen, ingen overlap')
  rows.forEach((r, i) => assert.equal(r.court_index, i, `court_index skal være ${i}`))
})

test('12 spillere: baner kan ikke overskride floor(n/4)=3', () => {
  const rows = buildMexicanoRoundMatches({
    tournamentId: 't12',
    roundNumber: 1,
    participantIdsInJoinOrder: IDS12,
    priorMatches: [],
    pointsPerMatch: P,
    totalRounds: 11,
    courtsPerRound: 10, // klippes til 3
  })
  assert.equal(rows.length, 3)
})

// ── Pairing ─────────────────────────────────────────────────────────────────

test('mexicano pairing er 1+4 vs 2+3 among court players', () => {
  const court = [
    { participantId: 'a', points: 40, courtAppearances: 1, sortIndex: 0 },
    { participantId: 'b', points: 30, courtAppearances: 1, sortIndex: 1 },
    { participantId: 'c', points: 20, courtAppearances: 1, sortIndex: 2 },
    { participantId: 'd', points: 10, courtAppearances: 1, sortIndex: 3 },
  ]
  const { teamA, teamB } = pairMexicanoOnCourt(court)
  assert.deepEqual(teamA.sort(), ['a', 'd'].sort())
  assert.deepEqual(teamB.sort(), ['b', 'c'].sort())
})

test('bænkspiller med færrest kampe prioriteres i næste runde', () => {
  const prior = [
    lockedMatch(1, 'p0', 'p1', 'p2', 'p3', 10, 6),
  ]
  const standings = computeMexicanoStandings(IDS, prior, P)
  const court = selectMexicanoCourtPlayers(standings)
  const courtIds = court.map((c) => c.participantId)
  assert.ok(courtIds.includes('p4'), 'p4 skal spille efter at have siddet runde 1')
})

// ── Advance ─────────────────────────────────────────────────────────────────

test('buildNextMexicanoRoundIfReady returnerer array efter runde fuldført', () => {
  const tournament = { id: 't1', opponent_passes: 1, courts_per_round: 1 }
  const m1 = lockedMatch(1, 'p0', 'p1', 'p2', 'p3', 10, 6)
  const next = buildNextMexicanoRoundIfReady(tournament, IDS, [m1], P)
  assert.ok(Array.isArray(next), 'returnerer array')
  assert.equal(next.length, 1)
  assert.equal(next[0].round_number, 2)
})

test('buildNextMexicanoRoundIfReady: 12 spillere, 3 baner → array med 3 rækker', () => {
  const tournament = { id: 't12', opponent_passes: 1, courts_per_round: 3 }
  const lockedRound1 = [
    lockedMatch(1, 'p0', 'p1', 'p2', 'p3', 10, 6, 0),
    lockedMatch(1, 'p4', 'p5', 'p6', 'p7', 12, 4, 1),
    lockedMatch(1, 'p8', 'p9', 'p10', 'p11', 8, 8, 2),
  ]
  const next = buildNextMexicanoRoundIfReady(tournament, IDS12, lockedRound1, P)
  assert.ok(Array.isArray(next))
  assert.equal(next.length, 3, '3 baner i runde 2')
})

test('advance ikke hvis runden er ufuldstændig', () => {
  const tournament = { id: 't1', opponent_passes: 1, courts_per_round: 1 }
  const partial = {
    round_number: 1,
    team_a_p1: 'p0',
    team_a_p2: 'p1',
    team_b_p1: 'p2',
    team_b_p2: 'p3',
    team_a_score: null,
    team_b_score: null,
  }
  assert.equal(buildNextMexicanoRoundIfReady(tournament, IDS, [partial], P), null)
  assert.equal(isRoundComplete([partial], 1), false)
})

test('advance ikke hvis multi-court runde er delvist fuldstændig', () => {
  const tournament = { id: 't12', opponent_passes: 1, courts_per_round: 3 }
  const partialRound = [
    lockedMatch(1, 'p0', 'p1', 'p2', 'p3', 10, 6, 0),
    { round_number: 1, court_index: 1, team_a_p1: 'p4', team_a_p2: 'p5', team_b_p1: 'p6', team_b_p2: 'p7', team_a_score: null, team_b_score: null },
    lockedMatch(1, 'p8', 'p9', 'p10', 'p11', 8, 8, 2),
  ]
  assert.equal(buildNextMexicanoRoundIfReady(tournament, IDS12, partialRound, P), null)
})
