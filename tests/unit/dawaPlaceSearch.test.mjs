import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchDawaPlaces,
  isValidCityPlace,
  hasIncompleteCityProfile,
  resolveCityPlaceFromName,
  cityNameCandidates,
} from '../../src/lib/dawaPlaceSearch.js';

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

test('resolveCityPlaceFromName prefers exact city match', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('stednavne')) {
      return {
        ok: true,
        json: async () => [{
          id: 'aalborg',
          hovedtype: 'Bebyggelse',
          undertype: 'by',
          navn: 'Aalborg',
          visueltcenter: [9.92, 57.05],
          kommuner: [{ navn: 'Aalborg' }],
        }],
      };
    }
    return {
      ok: true,
      json: async () => [{
        tekst: '9000 Aalborg',
        postnummer: {
          nr: '9000',
          navn: 'Aalborg',
          visueltcenter_x: 9.93,
          visueltcenter_y: 57.04,
        },
      }],
    };
  };

  const place = await resolveCityPlaceFromName('Aalborg', { fetchImpl });
  assert.equal(place.city, 'Aalborg');
  assert.ok(Number.isFinite(place.latitude));
});

test('resolveCityPlaceFromName prefers postnummer over same-named villages', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('stednavne')) {
      return {
        ok: true,
        json: async () => [{
          id: 'wrong',
          hovedtype: 'Bebyggelse',
          navn: 'Vejen',
          visueltcenter: [10.43, 57.48],
          kommuner: [{ navn: 'Frederikshavn' }],
        }, {
          id: 'right',
          hovedtype: 'Bebyggelse',
          navn: 'Vejen',
          visueltcenter: [9.13, 55.47],
          kommuner: [{ navn: 'Vejen' }],
        }],
      };
    }
    return {
      ok: true,
      json: async () => [{
        tekst: '6600 Vejen',
        postnummer: {
          nr: '6600',
          navn: 'Vejen',
          visueltcenter_x: 9.11,
          visueltcenter_y: 55.48,
        },
      }],
    };
  };

  const place = await resolveCityPlaceFromName('Vejen', { fetchImpl });
  assert.equal(place.city, 'Vejen');
  assert.equal(place.source, 'postnummer');
  assert.ok(place.latitude < 56);
});

test('cityNameCandidates splits comma cities and normalizes Århus', () => {
  const c = cityNameCandidates('Aarhus, Hadsten');
  assert.ok(c.includes('Aarhus'));
  assert.ok(c.includes('Hadsten'));
  assert.ok(cityNameCandidates('Århus').includes('Aarhus'));
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

test('attachResolvedCityCoords slår by op når lat/lng mangler', async () => {
  const { attachResolvedCityCoords } = await import('../../src/lib/dawaPlaceSearch.js');
  const fetchImpl = async (url) => {
    if (String(url).includes('stednavne')) {
      return { ok: true, json: async () => [] };
    }
    return {
      ok: true,
      json: async () => [{
        tekst: '8000 Aarhus C',
        postnummer: {
          nr: '8000',
          navn: 'Aarhus C',
          visueltcenter_x: 10.2,
          visueltcenter_y: 56.15,
        },
      }],
    };
  };

  const [withCoords, filled, empty] = await attachResolvedCityCoords([
    { id: '1', city: 'Nørresundby', latitude: 57.08, longitude: 9.93 },
    { id: '2', city: 'Aarhus', latitude: null, longitude: null },
    { id: '3', city: null, latitude: null, longitude: null },
  ], { fetchImpl });

  assert.equal(withCoords.latitude, 57.08);
  assert.equal(filled.city, 'Aarhus');
  assert.equal(filled.latitude, 56.15);
  assert.equal(filled.longitude, 10.2);
  assert.equal(empty.latitude, null);
});
