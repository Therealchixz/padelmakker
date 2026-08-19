import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProfileLocationLine, distanceBetweenProfiles } from '../../src/lib/profileLocationLabel.js';

test('formatProfileLocationLine shows city and approx km', () => {
  const viewer = { city: 'Nørresundby', latitude: 57.065, longitude: 9.934 };
  const other = { city: 'Langholt', latitude: 57.08, longitude: 9.95 };
  const line = formatProfileLocationLine(viewer, other);
  assert.match(line, /^Langholt · ca\. \d+ km$/);
});

test('formatProfileLocationLine falls back to region without coords', () => {
  const line = formatProfileLocationLine(null, { area: 'Region Midtjylland' });
  assert.equal(line, 'Midtjylland');
});

test('distanceBetweenProfiles returns null when coords missing', () => {
  assert.equal(distanceBetweenProfiles({ latitude: 1, longitude: 2 }, { city: 'X' }), null);
});
