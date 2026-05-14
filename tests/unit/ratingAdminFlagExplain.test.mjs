import assert from 'node:assert/strict'
import test from 'node:test'

import { explainRatingAdminFlag } from '../../src/lib/ratingAdminFlagExplain.js'

test('explainRatingAdminFlag explains repeated quartet flags in plain Danish', () => {
  const explained = explainRatingAdminFlag({
    reason: 'repeated_quartet_high_volume_14d',
    payload: { same_quartet_14d: 10, window_days: 14 },
  })

  assert.match(explained.title, /Samme 4 spillere/)
  assert.match(explained.description, /10 kampe/)
  assert.match(explained.suggestion, /kamphistorikken/)
  assert.equal(explained.technicalReason, 'repeated_quartet_high_volume_14d')
})

test('explainRatingAdminFlag explains non zero-sum deltas and formats sign', () => {
  const explained = explainRatingAdminFlag({
    reason: 'non_zero_sum_match_delta',
    payload: { sum_change: 3, max_abs_change: 41, min_abs_change: 2 },
  })

  assert.match(explained.title, /samlede ELO-ændring/i)
  assert.match(explained.description, /\+3/)
  assert.match(explained.description, /41/)
  assert.match(explained.suggestion, /Prøv ELO igen/)
})

test('explainRatingAdminFlag falls back safely for unknown reasons', () => {
  const explained = explainRatingAdminFlag({
    reason: 'custom_future_flag',
    payload: {},
  })

  assert.match(explained.title, /custom future flag/i)
  assert.match(explained.description, /usædvanlig/i)
  assert.match(explained.suggestion, /manuelt/i)
  assert.equal(explained.technicalReason, 'custom_future_flag')
})

