import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  searchDawaPlaces,
  isValidCityPlace,
  hasIncompleteCityProfile,
  resolveCityPlaceFromName,
  cityNameCandidates,
} from '../../src/lib/dawaPlaceSearch.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('isValidCityPlace requires city and coordinates', () => {
  assert.equal(isValidCityPlace(null), false);
  assert.equal(isValidCityPlace({ city: 'Aarhus' }), false);
  assert.equal(isValidCityPlace({ city: 'Aarhus', latitude: null, longitude: null }), false);
  assert.equal(isValidCityPlace({ city: 'Aarhus', latitude: 56.16, longitude: 10.2 }), true);
});

test('hasIncompleteCityProfile detects city text without coordinates', () => {
  assert.equal(hasIncompleteCityProfile(null), false);
  assert.equal(hasIncompleteCityProfile({ city: 'Aalborg' }), true);
  assert.equal(hasIncompleteCityProfile({ city: 'Aarhus', latitude: null, longitude: null }), true);
  assert.equal(hasIncompleteCityProfile({ city: 'Aalborg', latitude: 57.05, longitude: 9.92 }), false);
});

test('resolveCityPlaceFromName finder byen i appens egen liste', async () => {
  const place = await resolveCityPlaceFromName('Aalborg');
  assert.equal(place.city, 'Aalborg');
  assert.ok(Math.abs(place.latitude - 57.05) < 0.05);
  assert.ok(Math.abs(place.longitude - 9.92) < 0.05);
});

test('resolveCityPlaceFromName vælger byen frem for landsbyer med samme navn', async () => {
  const place = await resolveCityPlaceFromName('Vejen');
  assert.equal(place.city, 'Vejen');
  assert.ok(place.latitude < 56, 'Vejen ved Kolding, ikke landsbyen i Nordjylland');
});

test('resolveCityPlaceFromName: Holbæk (gemt uden placering) får koordinater', async () => {
  const place = await resolveCityPlaceFromName('Holbæk');
  assert.equal(place.city, 'Holbæk');
  assert.ok(Math.abs(place.latitude - 55.72) < 0.05);
});

test('resolveCityPlaceFromName giver null for ukendt navn', async () => {
  assert.equal(await resolveCityPlaceFromName('Xyzzyqq'), null);
});

test('cityNameCandidates splits comma cities and normalizes Århus', () => {
  const c = cityNameCandidates('Aarhus, Hadsten');
  assert.ok(c.includes('Aarhus'));
  assert.ok(c.includes('Hadsten'));
  assert.ok(cityNameCandidates('Århus').includes('Aarhus'));
});

test('searchDawaPlaces finder landsbyer med nærmeste by og postbyer', async () => {
  const lang = await searchDawaPlaces('langh');
  assert.ok(lang.some((p) => p.city === 'Langholt' && /ved /.test(p.label)));
  const aalb = await searchDawaPlaces('aalb');
  assert.equal(aalb[0].city, 'Aalborg');
  assert.ok(aalb.some((p) => p.label === '9220 Aalborg Øst'));
});

test('searchDawaPlaces: postnummer giver postbyen', async () => {
  const places = await searchDawaPlaces('9310');
  assert.equal(places.length, 1);
  assert.equal(places[0].label, '9310 Vodskov');
  assert.equal(places[0].source, 'postnummer');
});

test('searchDawaPlaces tåler Århus/Aarhus, Ronne/Rønne og Kgs. Lyngby', async () => {
  assert.equal((await searchDawaPlaces('Århus'))[0].city, 'Aarhus');
  assert.equal((await searchDawaPlaces('ronne'))[0].city, 'Rønne');
  assert.equal((await searchDawaPlaces('Kgs. Lyngby'))[0].city, 'Kongens Lyngby');
  assert.equal((await searchDawaPlaces('Lyngby'))[0].city, 'Kongens Lyngby');
});

test('searchDawaPlaces viser København K kun én gang', async () => {
  const places = await searchDawaPlaces('københavn k');
  assert.equal(places.filter((p) => p.city === 'København K').length, 1);
});

test('alle steder har gyldige danske koordinater', async () => {
  const { DK_PLACES, DK_POSTAL } = await import('../../src/lib/dkPlacesData.js');
  assert.ok(DK_PLACES.length > 8000);
  assert.ok(DK_POSTAL.length > 1000);
  for (const [name, lat, lon] of DK_PLACES) {
    assert.ok(lat > 54.5 && lat < 57.8 && lon > 8 && lon < 15.2, `${name} ligger uden for Danmark`);
  }
});

test('bysøgningen kalder ikke længere den lukkede DAWA-tjeneste', () => {
  const src = readFileSync(join(root, 'src/lib/dawaPlaceSearch.js'), 'utf8');
  assert.ok(!src.includes('api.dataforsyningen.dk/'), 'DAWA svarer 410 Gone siden okt. 2026');
});

test('attachResolvedCityCoords slår by op når lat/lng mangler', async () => {
  const { attachResolvedCityCoords } = await import('../../src/lib/dawaPlaceSearch.js');
  const [withCoords, filled, empty] = await attachResolvedCityCoords([
    { id: '1', city: 'Nørresundby', latitude: 57.08, longitude: 9.93 },
    { id: '2', city: 'Aarhus', latitude: null, longitude: null },
    { id: '3', city: null, latitude: null, longitude: null },
  ]);

  assert.equal(withCoords.latitude, 57.08);
  assert.equal(filled.city, 'Aarhus');
  assert.ok(Math.abs(filled.latitude - 56.15) < 0.05);
  assert.ok(Math.abs(filled.longitude - 10.2) < 0.05);
  assert.equal(empty.latitude, null);
});
