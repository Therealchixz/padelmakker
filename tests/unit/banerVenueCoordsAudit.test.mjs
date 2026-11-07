import test from 'node:test';
import assert from 'node:assert/strict';
import { auditVenueCoords, parseVenueAddress } from '../../scripts/audit-baner-venue-coords.mjs';
import { BANER_VENUES, BANER_VENUES_RAW } from '../../src/lib/banerVenues.js';
import { BANER_VENUE_COORDS } from '../../src/lib/banerVenuesCoords.generated.js';
import { BANER_VENUE_COORDS_QUALITY } from '../../src/lib/banerVenuesCoordsQuality.generated.js';
import { haversineKm } from '../../src/lib/geoDistance.js';

const byId = (id) => BANER_VENUES.find((v) => v.id === id);

test('tjek-filen er opdateret (koer npm run baner:geo-audit efter ny geokodning)', () => {
  const fresh = auditVenueCoords(BANER_VENUES_RAW, BANER_VENUE_COORDS);
  assert.deepEqual(Object.keys(fresh).sort(), Object.keys(BANER_VENUE_COORDS_QUALITY).sort());
});

test('adresser laeses: postnummer, by og om der er en gadeadresse', () => {
  assert.deepEqual(parseVenueAddress('Sportsvej 5, 9480 , Løkken'), { postal: '9480', city: 'Løkken', noStreet: false });
  assert.deepEqual(parseVenueAddress('Nørresundby — se booking-link'), { postal: null, city: 'Nørresundby', noStreet: true });
});

test('Ingstrup Padelbane ligger ved Løkken, ikke 5 km fra Aalborg', () => {
  const v = byId('matchi_ingstruppadelbane');
  assert.equal(v.coordsApprox, true);
  assert.ok(haversineKm(v.latitude, v.longitude, 57.3705, 9.7113) < 15);
  assert.ok(haversineKm(v.latitude, v.longitude, 57.048, 9.919) > 30);
});

test('byer med samme navn: Lynge i Nordsjaelland og Ullerslev paa Fyn', () => {
  const lynge = byId('link_lynge_lynge_uggel_se_if_tennis_og_padel');
  assert.ok(haversineKm(lynge.latitude, lynge.longitude, 55.8395, 12.2748) < 3);
  const ull = byId('link_ullerslev_ullerslev_tennis_klub');
  assert.ok(haversineKm(ull.latitude, ull.longitude, 55.3615, 10.663) < 3);
});

test('centre uden gadeadresse faar ingen praecis pind', () => {
  assert.equal(byId('link_n_rresundby_rocket_padel_n_rresundby').coordsApprox, true);
  assert.equal(byId('skansen_ntsc').coordsApprox, undefined);
});
