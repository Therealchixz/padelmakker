import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAmericanoRoundRobinMatchRows,
  roundRobinTotalRounds,
  benchCountPerRound,
} from '../../src/lib/americanoRoundRobinSchedule.ts'

function ids(n) {
  return Array.from({ length: n }, (_, i) => `p${i}`)
}

// ── roundRobinTotalRounds ───────────────────────────────────────────────────

test('roundRobinTotalRounds: 4 spillere → 3 runder', () => {
  assert.equal(roundRobinTotalRounds(4), 3)
})
test('roundRobinTotalRounds: 5 spillere → 5 runder', () => {
  assert.equal(roundRobinTotalRounds(5), 5)
})
test('roundRobinTotalRounds: 6 spillere → 5 runder', () => {
  assert.equal(roundRobinTotalRounds(6), 5)
})
test('roundRobinTotalRounds: 16 spillere → 15 runder', () => {
  assert.equal(roundRobinTotalRounds(16), 15)
})

// ── benchCountPerRound ──────────────────────────────────────────────────────

test('benchCountPerRound: 5 spillere, 1 bane → 1 bænk', () => {
  assert.equal(benchCountPerRound(5, 1), 1)
})
test('benchCountPerRound: 8 spillere, 2 baner → 0 bænk', () => {
  assert.equal(benchCountPerRound(8, 2), 0)
})
test('benchCountPerRound: 9 spillere, 2 baner → 1 bænk', () => {
  assert.equal(benchCountPerRound(9, 2), 1)
})

// ── buildAmericanoRoundRobinMatchRows ────────────────────────────────────────

test('4 spillere, 1 bane: korrekt antal runder og matches', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(4), 1, 1)
  assert.equal(rows.length, 3, '3 runder × 1 kamp = 3 rækker')
  const rounds = new Set(rows.map((r) => r.round_number))
  assert.equal(rounds.size, 3)
})

test('5 spillere, 1 bane: ingen spiller i to matches i samme runde', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(5), 1, 1)
  for (const round of new Set(rows.map((r) => r.round_number))) {
    const roundRows = rows.filter((r) => r.round_number === round)
    const players = roundRows.flatMap((r) => [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2])
    assert.equal(new Set(players).size, players.length, `Runde ${round}: spiller overlap`)
  }
})

test('16 spillere, 4 baner: alle 16 spiller i runde 1', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(16), 4, 1)
  const runde1 = rows.filter((r) => r.round_number === 1)
  assert.equal(runde1.length, 4, '4 baner → 4 kampe i runde 1')
  const players = runde1.flatMap((r) => [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2])
  assert.equal(new Set(players).size, 16, 'alle 16 spillere er på banen')
})

test('court_index udfyldes 0..courts-1', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(12), 3, 1)
  const runde1 = rows.filter((r) => r.round_number === 1).sort((a, b) => a.court_index - b.court_index)
  assert.deepEqual(runde1.map((r) => r.court_index), [0, 1, 2])
})

test('passes=2 giver dobbelt antal runder', () => {
  const rows1 = buildAmericanoRoundRobinMatchRows('tid', ids(6), 1, 1)
  const rows2 = buildAmericanoRoundRobinMatchRows('tid', ids(6), 1, 2)
  assert.equal(rows2.length, rows1.length * 2)
})

test('ingen spiller i to matches i samme runde – 12 spillere 3 baner', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(12), 3, 1)
  for (const round of new Set(rows.map((r) => r.round_number))) {
    const roundRows = rows.filter((r) => r.round_number === round)
    const players = roundRows.flatMap((r) => [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2])
    assert.equal(new Set(players).size, players.length, `Runde ${round}: spiller overlap`)
  }
})
