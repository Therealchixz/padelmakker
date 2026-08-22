import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, formatApproxKm, parseGeoCoords } from '../../src/lib/geoDistance.js';

test('haversineKm returns distance between Copenhagen and Aarhus', () => {
  const km = haversineKm(55.6761, 12.5683, 56.1629, 10.2039);
  assert.ok(km != null && km > 140 && km < 200);
});

test('haversineKm returns null for invalid coords', () => {
  assert.equal(haversineKm(null, 12, 56, 10), null);
});

test('parseGeoCoords treats missing coords as missing — Number(null) is 0', () => {
  assert.equal(parseGeoCoords(null, null), null);
  assert.equal(parseGeoCoords(undefined, undefined), null);
  assert.equal(parseGeoCoords(0, 0), null);
  assert.equal(parseGeoCoords('0', '0'), null);
  assert.ok(parseGeoCoords(57.065, 9.934));
});

test('haversineKm does not treat Null Island as a Danish city', () => {
  /* Nørresundby → (0,0) er ~6400 km; det skal ikke vises som afstand. */
  assert.equal(haversineKm(57.065, 9.934, 0, 0), null);
  assert.equal(haversineKm(57.065, 9.934, null, null), null);
});

test('formatApproxKm formats sub-km and longer distances', () => {
  assert.equal(formatApproxKm(0.4), '400 m');
  assert.equal(formatApproxKm(3.2), '3 km');
  assert.equal(formatApproxKm(28), '30 km');
});
