import test from 'node:test';
import assert from 'node:assert/strict';
import { searchDawaPlaces, isValidCityPlace } from '../../src/lib/dawaPlaceSearch.js';

test('isValidCityPlace requires city and coordinates', () => {
  assert.equal(isValidCityPlace(null), false);
  assert.equal(isValidCityPlace({ city: 'Aarhus' }), false);
  assert.equal(isValidCityPlace({ city: 'Aarhus', latitude: 56.16, longitude: 10.2 }), true);
});

test('searchDawaPlaces maps stednavn and postnummer results', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('stednavne')) {
      return {
        ok: true,
        json: async () => [{
          id: 'abc',
          hovedtype: 'Bebyggelse',
          undertype: 'by',
          navn: 'Langholt',
          visueltcenter: [9.93, 57.06],
          kommuner: [{ navn: 'Aalborg' }],
        }],
      };
    }
    return {
      ok: true,
      json: async () => [{
        tekst: '9220 Aalborg Øst',
        postnummer: {
          nr: '9220',
          navn: 'Aalborg Øst',
          visueltcenter_x: 10.01,
          visueltcenter_y: 57.05,
        },
      }],
    };
  };

  const places = await searchDawaPlaces('lang', { fetchImpl });
  assert.ok(places.length >= 2);
  assert.equal(places[0].city, 'Langholt');
  assert.equal(places[0].latitude, 57.06);
  assert.equal(places[0].longitude, 9.93);
});
