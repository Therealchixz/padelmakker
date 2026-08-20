import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getReactivationOpenMatches,
  mergeReactivationOpenMatches,
} from '../../src/lib/notificationPreferences.js';

test('normalizeNotificationPrefs defaults reactivationOpenMatches to weekly', () => {
  assert.equal(getReactivationOpenMatches(null), 'weekly');
  assert.equal(getReactivationOpenMatches({}), 'weekly');
});

test('mergeReactivationOpenMatches persists valid values', () => {
  const daily = mergeReactivationOpenMatches({}, 'daily');
  assert.equal(daily.reactivationOpenMatches, 'daily');
  assert.equal(getReactivationOpenMatches(daily), 'daily');

  const off = mergeReactivationOpenMatches(daily, 'off');
  assert.equal(off.reactivationOpenMatches, 'off');
});

test('mergeReactivationOpenMatches ignores invalid values', () => {
  const next = mergeReactivationOpenMatches({ reactivationOpenMatches: 'hourly' }, 'hourly');
  assert.equal(next.reactivationOpenMatches, 'weekly');
});
