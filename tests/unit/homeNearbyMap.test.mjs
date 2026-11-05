import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNearbyVenues, formatNearbyKm } from '../../src/lib/homeNearbyMap.js';

const me = { latitude: 57.048, longitude: 9.919 }; // Aalborg
const venues = [
  { id: 'a', title: 'Skansen Padel', latitude: 57.05, longitude: 9.92 },
  { id: 'b', title: 'Padel Nord', latitude: 57.07, longitude: 9.93 },
  { id: 'c', title: 'Padel København', latitude: 55.676, longitude: 12.568 },
  { id: 'd', title: 'Uden koordinater' },
  { id: 'e', title: 'skansen padel', latitude: 57.05, longitude: 9.92 },
];

test('kortet viser kun centre i naerheden, uden dubletter og uden koordinatloese', () => {
  const rows = buildNearbyVenues(venues, me, []);
  assert.deepEqual(rows.map((r) => r.id).sort(), ['a', 'b']);
});

test('centre med aabne kampe kommer foerst og taeller kampene via banens navn', () => {
  const rows = buildNearbyVenues(venues, me, [
    { matchId: 1, court: 'Padel Nord' },
    { matchId: 2, court: '  padel nord ' },
    { matchId: 3, court: 'Bane ikke valgt endnu' },
  ]);
  assert.equal(rows[0].id, 'b');
  assert.equal(rows[0].matchCount, 2);
  assert.equal(rows[1].matchCount, 0);
});

test('uden spillerens placering er der intet kort', () => {
  assert.deepEqual(buildNearbyVenues(venues, null, []), []);
});

test('afstand skrives kort', () => {
  assert.equal(formatNearbyKm(0.4), 'under 1 km');
  assert.equal(formatNearbyKm(4.6), '5 km');
});
