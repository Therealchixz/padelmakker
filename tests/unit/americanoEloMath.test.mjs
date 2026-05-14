import assert from 'node:assert/strict'
import test from 'node:test'
import {
  americanoExpectedScore,
  calculateAmericanoEloRows,
  roundHalfAwayFromZero,
} from '../../src/lib/americanoEloMath.js'

test('roundHalfAwayFromZero is symmetric for positive and negative halves', () => {
  assert.equal(roundHalfAwayFromZero(2.5), 3)
  assert.equal(roundHalfAwayFromZero(-2.5), -3)
  assert.equal(roundHalfAwayFromZero(2.49), 2)
  assert.equal(roundHalfAwayFromZero(-2.49), -2)
})

test('americanoExpectedScore is mirrored around 0.5 for equal ratings', () => {
  assert.equal(americanoExpectedScore(1000, 1000), 0.5)
  const a = americanoExpectedScore(1100, 900)
  const b = americanoExpectedScore(900, 1100)
  assert.ok(Math.abs(a + b - 1) < 1e-9)
})

test('calculateAmericanoEloRows preserves total delta and rewards higher points', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'p1', rating: 1000, points: 52 },
    { id: 'p2', rating: 1000, points: 48 },
    { id: 'p3', rating: 1000, points: 44 },
    { id: 'p4', rating: 1000, points: 40 },
  ])

  const byId = new Map(rows.map((r) => [r.id, r]))
  assert.equal(rows.reduce((sum, r) => sum + r.delta, 0), 0)
  assert.ok(byId.get('p1').delta > 0)
  assert.ok(byId.get('p4').delta < 0)
  assert.ok(byId.get('p1').delta > byId.get('p2').delta)
  assert.ok(byId.get('p2').delta > byId.get('p3').delta)
})

test('calculateAmericanoEloRows gives near-zero movement when all points are tied', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'a', rating: 1030, points: 30 },
    { id: 'b', rating: 980, points: 30 },
    { id: 'c', rating: 1005, points: 30 },
    { id: 'd', rating: 990, points: 30 },
  ])
  assert.equal(rows.reduce((sum, r) => sum + r.delta, 0), 0)
  assert.ok(rows.every((r) => Math.abs(r.delta) <= 2))
})

/* ────────────────────────────────────────────────────────────────────────── */
/*  Extended scenarios                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

test('5-player tournament still zero-sums and rewards top scorer', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'p1', rating: 1000, points: 60 },
    { id: 'p2', rating: 1000, points: 50 },
    { id: 'p3', rating: 1000, points: 40 },
    { id: 'p4', rating: 1000, points: 30 },
    { id: 'p5', rating: 1000, points: 20 },
  ])
  assert.equal(rows.length, 5)
  assert.equal(rows.reduce((s, r) => s + r.delta, 0), 0)
  const byId = new Map(rows.map((r) => [r.id, r]))
  assert.ok(byId.get('p1').delta > byId.get('p2').delta)
  assert.ok(byId.get('p4').delta > byId.get('p5').delta)
  assert.ok(byId.get('p1').delta > 0)
  assert.ok(byId.get('p5').delta < 0)
})

test('6-player tournament zero-sums', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'a', rating: 1100, points: 55 },
    { id: 'b', rating: 1100, points: 50 },
    { id: 'c', rating: 1000, points: 45 },
    { id: 'd', rating: 1000, points: 40 },
    { id: 'e', rating: 900, points: 35 },
    { id: 'f', rating: 900, points: 30 },
  ])
  assert.equal(rows.length, 6)
  assert.equal(rows.reduce((s, r) => s + r.delta, 0), 0)
})

test('7-player tournament zero-sums and ties produce equal deltas', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'a', rating: 1000, points: 50 },
    { id: 'b', rating: 1000, points: 50 },
    { id: 'c', rating: 1000, points: 50 },
    { id: 'd', rating: 1000, points: 50 },
    { id: 'e', rating: 1000, points: 50 },
    { id: 'f', rating: 1000, points: 50 },
    { id: 'g', rating: 1000, points: 50 },
  ])
  assert.equal(rows.length, 7)
  assert.equal(rows.reduce((s, r) => s + r.delta, 0), 0)
  /* Alle har lige rating og lige point ⇒ delta bør være ~0 for hver */
  assert.ok(rows.every((r) => Math.abs(r.delta) <= 1))
})

test('extreme rating spread: low-rated winner gets big gain, high-rated loser big loss', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'low_winner', rating: 800, points: 70 },
    { id: 'mid_a', rating: 1000, points: 50 },
    { id: 'mid_b', rating: 1000, points: 50 },
    { id: 'high_loser', rating: 1400, points: 30 },
  ])
  const low = rows.find((r) => r.id === 'low_winner')
  const high = rows.find((r) => r.id === 'high_loser')
  assert.ok(low.delta > 0, `low_winner skulle vinde ELO (delta=${low.delta})`)
  assert.ok(high.delta < 0, `high_loser skulle tabe ELO (delta=${high.delta})`)
  assert.ok(Math.abs(low.delta) >= 5, `upset-gevinst skulle være mærkbar (delta=${low.delta})`)
})

test('1-point margin between adjacent placements still ranks correctly', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'p1', rating: 1000, points: 51 },
    { id: 'p2', rating: 1000, points: 50 },
    { id: 'p3', rating: 1000, points: 49 },
    { id: 'p4', rating: 1000, points: 48 },
  ])
  const byId = new Map(rows.map((r) => [r.id, r]))
  /* Vi kan ikke garantere strict monotonicitet ved tæt margin pga. rounding,
     men deltas skal mindst være ikke-stigende top-til-bund. */
  assert.ok(byId.get('p1').delta >= byId.get('p2').delta)
  assert.ok(byId.get('p2').delta >= byId.get('p3').delta)
  assert.ok(byId.get('p3').delta >= byId.get('p4').delta)
  assert.equal(rows.reduce((s, r) => s + r.delta, 0), 0)
})

test('newRating never drops below minRating (default 100)', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'p1', rating: 1500, points: 60 },
    { id: 'p2', rating: 1500, points: 55 },
    { id: 'p3', rating: 1500, points: 50 },
    { id: 'low', rating: 105, points: 10 },
  ])
  for (const r of rows) {
    assert.ok(r.newRating >= 100, `${r.id}: newRating ${r.newRating} < 100`)
  }
})

test('empty player list returns empty array', () => {
  assert.deepEqual(calculateAmericanoEloRows([]), [])
})

test('single player returns row with delta 0', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'solo', rating: 1234, points: 99 },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].delta, 0)
  assert.equal(rows[0].newRating, 1234)
})

test('newRating = oldRating + delta for every player (above floor)', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'p1', rating: 1234, points: 60 },
    { id: 'p2', rating: 987, points: 40 },
    { id: 'p3', rating: 1100, points: 50 },
    { id: 'p4', rating: 1050, points: 30 },
  ])
  for (const r of rows) {
    assert.equal(r.newRating, Math.max(100, Math.round(r.rating + r.delta)))
  }
})

test('total point-sum-tie produces zero-sum even with mixed ratings', () => {
  const rows = calculateAmericanoEloRows([
    { id: 'a', rating: 1500, points: 40 },
    { id: 'b', rating: 1000, points: 40 },
    { id: 'c', rating: 800, points: 40 },
    { id: 'd', rating: 1200, points: 40 },
  ])
  assert.equal(rows.reduce((s, r) => s + r.delta, 0), 0)
  /* Ved point-tie skal høj-rated spillere TABE marginalt (forventet sejr ikke leveret) */
  const byId = new Map(rows.map((r) => [r.id, r]))
  assert.ok(byId.get('a').delta <= byId.get('c').delta, `1500 skulle tabe mere/lige meget som 800 ved tie`)
})
