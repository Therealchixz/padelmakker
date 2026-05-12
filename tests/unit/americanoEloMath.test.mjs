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

