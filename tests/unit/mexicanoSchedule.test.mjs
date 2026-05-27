import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMexicanoRoundMatch,
  buildNextMexicanoRoundIfReady,
  computeMexicanoStandings,
  getMexicanoTotalRounds,
  isRoundComplete,
  pairMexicanoOnCourt,
  selectMexicanoCourtPlayers,
} from '../../src/lib/mexicanoSchedule.js'

const P = 16
const IDS = ['p0', 'p1', 'p2', 'p3', 'p4']

function lockedMatch(round, a1, a2, b1, b2, scoreA, scoreB) {
  return {
    round_number: round,
    team_a_p1: a1,
    team_a_p2: a2,
    team_b_p1: b1,
    team_b_p2: b2,
    team_a_score: scoreA,
    team_b_score: scoreB,
    results_locked: true,
  }
}

test('getMexicanoTotalRounds matches americano round counts', () => {
  assert.equal(getMexicanoTotalRounds(5, 1), 5)
  assert.equal(getMexicanoTotalRounds(6, 2), 12)
})

test('round 1 uses join order for fair first bench', () => {
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

test('mexicano pairing is 1+4 vs 2+3 among court players', () => {
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

test('bench player with fewest court appearances gets priority next round', () => {
  const prior = [
    lockedMatch(1, 'p0', 'p1', 'p2', 'p3', 10, 6),
  ]
  const standings = computeMexicanoStandings(IDS, prior, P)
  const court = selectMexicanoCourtPlayers(standings)
  const courtIds = court.map((c) => c.participantId)
  assert.ok(courtIds.includes('p4'), 'p4 should play after sitting round 1')
})

test('buildNextMexicanoRoundIfReady after round complete', () => {
  const tournament = { id: 't1', opponent_passes: 1 }
  const m1 = lockedMatch(1, 'p0', 'p1', 'p2', 'p3', 10, 6)
  const next = buildNextMexicanoRoundIfReady(tournament, IDS, [m1], P)
  assert.ok(next)
  assert.equal(next.round_number, 2)
})

test('does not advance if round incomplete', () => {
  const tournament = { id: 't1', opponent_passes: 1 }
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
