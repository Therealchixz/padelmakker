import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoMatches, buildNearbyVenues, formatNearbyKm, nearbyVenueMeta } from '../../src/lib/homeNearbyMap.js';

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

test('centrene sorteres rent efter afstand og taeller kampene via banens navn', () => {
  const rows = buildNearbyVenues(venues, me, [
    { matchId: 1, court: 'Padel Nord' },
    { matchId: 2, court: '  padel nord ' },
    { matchId: 3, court: 'Bane ikke valgt endnu' },
  ]);
  // Skansen (under 1 km, ingen kampe) staar foer Padel Nord (3 km, 2 kampe).
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b']);
  assert.equal(rows[0].matchCount, 0);
  assert.equal(rows[1].matchCount, 2);
});

test('uden spillerens placering er der intet kort', () => {
  assert.deepEqual(buildNearbyVenues(venues, null, []), []);
});

test('afstand skrives kort', () => {
  assert.equal(formatNearbyKm(0.4), 'under 1 km');
  assert.equal(formatNearbyKm(4.6), '5 km');
});

test('centre kun placeret i byens midte markeres og skrives med "ca."', () => {
  const rows = buildNearbyVenues([
    { id: 'x', title: 'By-center', latitude: 57.06, longitude: 9.92, coordsApprox: true },
    { id: 'y', title: 'Rigtig adresse', latitude: 57.064, longitude: 9.934, indoor: false },
  ], me, []);
  const x = rows.find((r) => r.id === 'x');
  const y = rows.find((r) => r.id === 'y');
  assert.equal(x.approx, true);
  assert.equal(y.approx, false);
  assert.equal(formatNearbyKm(2.2, true), 'ca. 2 km');
  assert.equal(formatNearbyKm(0.4, true), 'ca. 1 km');
});

test('linjen under centret: aabne kampe og naeste kamp, ellers afstand', () => {
  const now = new Date('2026-11-07T12:00:00');
  const rows = buildNearbyVenues(venues, me, [
    { matchId: 1, court: 'Padel Nord', date: '2026-11-09', time: '19:00:00' },
    { matchId: 2, court: 'Padel Nord', date: '2026-11-08', time: '18:30:00' },
  ]);
  const nord = rows.find((r) => r.id === 'b');
  assert.equal(nearbyVenueMeta(nord, 'kampe', now), '2 åbne · næste i morgen 18:30 · 3 km');
  const skansen = rows.find((r) => r.id === 'a');
  assert.equal(nearbyVenueMeta(skansen, 'kampe', now), 'Ingen åbne kampe · under 1 km');
  assert.equal(nearbyVenueMeta({ ...skansen, indoor: true }, 'baner', now), 'under 1 km · indendørs');
});

test('kortet kan vise alle landets centre (maxKm og limit uden graense), stadig sorteret efter afstand', () => {
  const venues = [
    { id: 'a', title: 'Naer', latitude: 57.05, longitude: 9.92 },
    { id: 'b', title: 'Esbjerg', latitude: 55.505, longitude: 8.406 },
    { id: 'c', title: 'Bornholm', latitude: 55.1, longitude: 14.7 },
  ];
  const me = { latitude: 57.0587, longitude: 9.9227 };
  assert.deepEqual(buildNearbyVenues(venues, me, []).map((v) => v.id), ['a']);
  const all = buildNearbyVenues(venues, me, [], { maxKm: Infinity, limit: Infinity });
  assert.deepEqual(all.map((v) => v.id), ['a', 'b', 'c']);
});

test('eksempel-kampe: 3 naermeste praecise centre, et langt vaek og een uden bane, alle maerket demo', () => {
  const list = [
    { title: 'A', km: 1 }, { title: 'Ca', km: 1.5, approx: true }, { title: 'B', km: 4 },
    { title: 'C', km: 9 }, { title: 'D', km: 40 }, { title: 'Fjern', km: 190 },
  ];
  const out = buildDemoMatches(list, new Date(2026, 10, 9));
  const courts = [...new Set(out.map((m) => m.court))];
  assert.deepEqual(courts, ['A', 'B', 'C', 'Fjern', 'Bane ikke valgt endnu']);
  assert.ok(out.every((m) => m.demo === true && String(m.matchId).startsWith('demo-')));
  assert.ok(out.every((m) => m.date > '2026-11-09'), 'kun kommende datoer');
  assert.equal(new Set(out.map((m) => m.matchId)).size, out.length);
});
