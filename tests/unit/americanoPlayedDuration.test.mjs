import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeAmericanoPlayedDurationMinutes,
  formatAmericanoDurationLabel,
} from '../../src/lib/americanoPlayedDuration.js'

test('computeAmericanoPlayedDurationMinutes from first match to last locked', () => {
  const tournament = {
    status: 'completed',
    created_at: '2026-01-01T10:00:00Z',
    completed_at: '2026-01-01T12:30:00Z',
    updated_at: '2026-01-01T12:30:00Z',
  }
  const matches = [
    {
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:45:00Z',
      team_a_score: 16,
      team_b_score: 0,
      results_locked: true,
    },
    {
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T12:20:00Z',
      team_a_score: 12,
      team_b_score: 4,
      results_locked: true,
    },
  ]
  const mins = computeAmericanoPlayedDurationMinutes(tournament, matches)
  assert.equal(mins, 150)
})

test('formatAmericanoDurationLabel uses estimate only when no actual minutes', () => {
  assert.equal(formatAmericanoDurationLabel(45, 120), '45 min')
  assert.equal(formatAmericanoDurationLabel(90, 120), '1 t 30 min')
  assert.equal(formatAmericanoDurationLabel(null, 120), '~120 min')
})

test('non-completed tournaments return null duration', () => {
  assert.equal(
    computeAmericanoPlayedDurationMinutes({ status: 'registration' }, []),
    null,
  )
})
