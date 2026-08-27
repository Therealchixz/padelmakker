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

test('formatProfileLocationLine does not show km when the other player has no city coords', () => {
  const viewer = { city: 'Nørresundby', latitude: 57.065, longitude: 9.934 };
  const lone = { area: 'Region Nordjylland', city: null, latitude: null, longitude: null };
  const line = formatProfileLocationLine(viewer, lone);
  assert.equal(line, 'Nordjylland');
  assert.equal(distanceBetweenProfiles(viewer, lone), null);
});

test('formatProfileLocationLine viser kun by uden km når den anden mangler koordinater', () => {
  const viewer = { city: 'Nørresundby', latitude: 57.081, longitude: 9.928 };
  const kenneth = { city: 'Aarhus', latitude: null, longitude: null };
  assert.equal(formatProfileLocationLine(viewer, kenneth), 'Aarhus');
});

test('formatProfileLocationLine viser ca. km når begge har koordinater', () => {
  const viewer = { city: 'Nørresundby', latitude: 57.081, longitude: 9.928 };
  const kenneth = { city: 'Aarhus', latitude: 56.15051496, longitude: 10.27802097 };
  const line = formatProfileLocationLine(viewer, kenneth);
  assert.match(line, /^Aarhus · ca\. \d+ km$/);
});

test('formatProfileLocationLine ignores 0,0 placeholders', () => {
  const viewer = { city: 'Nørresundby', latitude: 57.065, longitude: 9.934 };
  const other = { area: 'Region Nordjylland', latitude: 0, longitude: 0 };
  const line = formatProfileLocationLine(viewer, other);
  assert.equal(line, 'Nordjylland');
});

test('distanceBetweenProfiles returns null when coords missing', () => {
  assert.equal(distanceBetweenProfiles({ latitude: 1, longitude: 2 }, { city: 'X' }), null);
});
