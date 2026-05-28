import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAmericanoRoundRobinMatchRows,
  roundRobinTotalRounds,
  americanoBaseRounds,
  americanoTotalRounds,
  benchCountPerRound,
} from '../../src/lib/americanoRoundRobinSchedule.ts'

function ids(n) {
  return Array.from({ length: n }, (_, i) => `p${i}`)
}

function coverage(rows, n) {
  const playerIds = ids(n)
  const partners = new Map(playerIds.map((id) => [id, new Set()]))
  const opponents = new Map(playerIds.map((id) => [id, new Set()]))
  for (const r of rows) {
    const a = [r.team_a_p1, r.team_a_p2]
    const b = [r.team_b_p1, r.team_b_p2]
    partners.get(a[0]).add(a[1])
    partners.get(a[1]).add(a[0])
    partners.get(b[0]).add(b[1])
    partners.get(b[1]).add(b[0])
    for (const x of a) {
      for (const y of b) {
        opponents.get(x).add(y)
        opponents.get(y).add(x)
      }
    }
  }
  const allPartners = playerIds.every((id) => partners.get(id).size === n - 1)
  const allOpponents = playerIds.every((id) => opponents.get(id).size === n - 1)
  return { allPartners, allOpponents }
}

// ── roundRobinTotalRounds (cirkel-basis) ────────────────────────────────────

test('roundRobinTotalRounds: 4 spillere → 3 runder', () => {
  assert.equal(roundRobinTotalRounds(4), 3)
})
test('roundRobinTotalRounds: 5 spillere → 5 runder', () => {
  assert.equal(roundRobinTotalRounds(5), 5)
})
test('roundRobinTotalRounds: 6 spillere → 5 runder', () => {
  assert.equal(roundRobinTotalRounds(6), 5)
})

// ── americanoBaseRounds (Normal) ────────────────────────────────────────────

test('americanoBaseRounds: 5 spillere, 1 bane → 5 runder', () => {
  assert.equal(americanoBaseRounds(5, 1), 5)
})
test('americanoBaseRounds: 6 spillere, 1 bane → 9 runder (fair pauser + dækning)', () => {
  assert.equal(americanoBaseRounds(6, 1), 9)
})
test('americanoBaseRounds: 8 spillere, 2 baner → 9 runder (fuld dækning)', () => {
  assert.equal(americanoBaseRounds(8, 2), 9)
})
test('americanoTotalRounds: 6 spillere Lang → 18 runder', () => {
  assert.equal(americanoTotalRounds(6, 1, 2), 18)
})

// ── benchCountPerRound ──────────────────────────────────────────────────────

test('benchCountPerRound: 5 spillere, 1 bane → 1 bænk', () => {
  assert.equal(benchCountPerRound(5, 1), 1)
})
test('benchCountPerRound: 8 spillere, 2 baner → 0 bænk', () => {
  assert.equal(benchCountPerRound(8, 2), 0)
})

// ── buildAmericanoRoundRobinMatchRows ────────────────────────────────────────

test('4 spillere, 1 bane: korrekt antal runder og matches', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(4), 1, 1)
  assert.equal(rows.length, 3, '3 runder × 1 kamp = 3 rækker')
  const rounds = new Set(rows.map((r) => r.round_number))
  assert.equal(rounds.size, 3)
})

test('5 spillere, 1 bane: makker og modstander med alle', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(5), 1, 1)
  const c = coverage(rows, 5)
  assert.equal(c.allPartners, true)
  assert.equal(c.allOpponents, true)
})

test('6 spillere, 1 bane Normal: 9 runder og fuld dækning', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(6), 1, 1)
  assert.equal(americanoBaseRounds(6, 1), 9)
  assert.equal(new Set(rows.map((r) => r.round_number)).size, 9)
  const c = coverage(rows, 6)
  assert.equal(c.allPartners, true)
  assert.equal(c.allOpponents, true)
})

test('6 spillere, 1 bane: alle spiller lige mange kampe', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(6), 1, 1)
  const counts = Object.fromEntries(ids(6).map((id) => [id, 0]))
  for (const r of rows) {
    for (const id of [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2]) {
      counts[id] += 1
    }
  }
  const values = Object.values(counts)
  assert.equal(Math.min(...values), Math.max(...values), 'alle skal have samme antal kampe')
})

test('6 spillere, 1 bane: ingen sidder over 2 runder i træk', () => {
  const playerIds = ids(6)
  const rows = buildAmericanoRoundRobinMatchRows('tid', playerIds, 1, 1)
  const rounds = [...new Set(rows.map((r) => r.round_number))].sort((a, b) => a - b)
  const sitPatterns = new Map(playerIds.map((id) => [id, []]))

  for (const rn of rounds) {
    const roundRows = rows.filter((r) => r.round_number === rn)
    const onCourt = new Set(
      roundRows.flatMap((r) => [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2]),
    )
    for (const id of playerIds) {
      sitPatterns.get(id).push(onCourt.has(id) ? 0 : 1)
    }
  }

  for (const [id, pattern] of sitPatterns) {
    let current = 0
    let maxStreak = 0
    for (const v of pattern) {
      if (v === 1) {
        current += 1
        if (current > maxStreak) maxStreak = current
      } else {
        current = 0
      }
    }
    assert.ok(maxStreak <= 1, `${id} har bench-streak ${maxStreak}: ${pattern.join('')}`)
  }
})

test('7 spillere, 1 bane: fuld makker og modstander-dækning', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(7), 1, 1)
  const c = coverage(rows, 7)
  assert.equal(c.allPartners, true)
  assert.equal(c.allOpponents, true)
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
  assert.equal(new Set(rows2.map((r) => r.round_number)).size, 18)
})

test('ingen spiller i to matches i samme runde – 12 spillere 3 baner', () => {
  const rows = buildAmericanoRoundRobinMatchRows('tid', ids(12), 3, 1)
  for (const round of new Set(rows.map((r) => r.round_number))) {
    const roundRows = rows.filter((r) => r.round_number === round)
    const players = roundRows.flatMap((r) => [r.team_a_p1, r.team_a_p2, r.team_b_p1, r.team_b_p2])
    assert.equal(new Set(players).size, players.length, `Runde ${round}: spiller overlap`)
  }
})
