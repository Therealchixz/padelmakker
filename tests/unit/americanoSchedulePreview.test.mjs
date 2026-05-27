import assert from 'node:assert/strict'
import test from 'node:test'
import { americanoBaseRounds, americanoTotalRounds } from '../../src/lib/americanoRoundRobinSchedule.ts'

function estimateMinutesPerRound(pointsPerMatch) {
  if (pointsPerMatch === 32) return 16
  if (pointsPerMatch === 24) return 12
  return 9
}

function getCreateFormSchedulePreview(input) {
  const format = input.format ?? 'americano'
  const playerSlots = Math.max(4, Number(input.playerSlots) || 6)
  const courts = Math.max(1, Number(input.courtsPerRound) || 1)
  const passes = Number(input.opponentPasses) === 2 ? 2 : 1
  const points = Number(input.pointsPerMatch) || 16
  const minPerRound = estimateMinutesPerRound(points)
  const normalRounds =
    format === 'mexicano'
      ? playerSlots % 2 === 0
        ? playerSlots - 1
        : playerSlots
      : americanoBaseRounds(playerSlots, courts)
  const longRounds =
    format === 'mexicano' ? normalRounds * 2 : americanoTotalRounds(playerSlots, courts, 2)
  const selectedRounds = passes === 2 ? longRounds : normalRounds
  const estSelectedMin = selectedRounds * minPerRound
  return { normalRounds, longRounds, selectedRounds, estSelectedMin }
}

test('6 spillere Americano: Normal 8 runder, Lang 16 runder', () => {
  const normal = getCreateFormSchedulePreview({
    format: 'americano',
    playerSlots: 6,
    courtsPerRound: 1,
    opponentPasses: 1,
    pointsPerMatch: 16,
  })
  const lang = getCreateFormSchedulePreview({
    format: 'americano',
    playerSlots: 6,
    courtsPerRound: 1,
    opponentPasses: 2,
    pointsPerMatch: 16,
  })
  assert.equal(normal.normalRounds, 8)
  assert.equal(normal.longRounds, 16)
  assert.equal(normal.selectedRounds, 8)
  assert.equal(lang.selectedRounds, 16)
  assert.equal(lang.estSelectedMin, 16 * estimateMinutesPerRound(16))
})

test('pointformat skalerer estimat', () => {
  const a = getCreateFormSchedulePreview({
    format: 'americano',
    playerSlots: 6,
    courtsPerRound: 1,
    opponentPasses: 1,
    pointsPerMatch: 16,
  })
  const b = getCreateFormSchedulePreview({
    format: 'americano',
    playerSlots: 6,
    courtsPerRound: 1,
    opponentPasses: 1,
    pointsPerMatch: 32,
  })
  assert.ok(b.estSelectedMin > a.estSelectedMin)
})
