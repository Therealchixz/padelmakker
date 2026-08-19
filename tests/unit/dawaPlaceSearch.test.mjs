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
  assert.ok(places.some((p) => p.city === 'Langholt'));
  assert.ok(places.some((p) => p.city === 'Aalborg Øst'));
});

test('searchDawaPlaces uses postnumre only for digit queries (no stednavne noise)', async () => {
  let stednavneCalled = false;
  const fetchImpl = async (url) => {
    if (String(url).includes('stednavne')) {
      stednavneCalled = true;
      return {
        ok: true,
        json: async () => [{
          id: 'noise',
          hovedtype: 'Andentopografi punkt',
          navn: '10',
          visueltcenter: [9.5, 55.5],
          kommuner: [{ navn: 'Aabenraa' }],
        }],
      };
    }
    return {
      ok: true,
      json: async () => [{
        tekst: '9310 Vodskov',
        postnummer: {
          nr: '9310',
          navn: 'Vodskov',
          visueltcenter_x: 9.95,
          visueltcenter_y: 57.1,
        },
      }],
    };
  };

  const places = await searchDawaPlaces('9310', { fetchImpl });
  assert.equal(stednavneCalled, false);
  assert.equal(places.length, 1);
  assert.equal(places[0].label, '9310 Vodskov');
});
