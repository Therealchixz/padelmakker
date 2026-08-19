import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, formatApproxKm } from '../../src/lib/geoDistance.js';

test('haversineKm returns distance between Copenhagen and Aarhus', () => {
  const km = haversineKm(55.6761, 12.5683, 56.1629, 10.2039);
  assert.ok(km != null && km > 140 && km < 200);
});

test('haversineKm returns null for invalid coords', () => {
  assert.equal(haversineKm(null, 12, 56, 10), null);
});

test('formatApproxKm formats sub-km and longer distances', () => {
  assert.equal(formatApproxKm(0.4), '400 m');
  assert.equal(formatApproxKm(3.2), '3 km');
  assert.equal(formatApproxKm(28), '30 km');
});
