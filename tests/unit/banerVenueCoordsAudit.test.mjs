import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditVenueCoords,
  loadGeocodeCache,
  parseVenueAddress,
  placeNameMatchesVenue,
} from '../../scripts/audit-baner-venue-coords.mjs';
import { BANER_VENUES, BANER_VENUES_RAW } from '../../src/lib/banerVenues.js';
import { BANER_VENUE_COORDS } from '../../src/lib/banerVenuesCoords.generated.js';
import { BANER_VENUE_COORDS_QUALITY } from '../../src/lib/banerVenuesCoordsQuality.generated.js';
import { haversineKm } from '../../src/lib/geoDistance.js';

const byId = (id) => BANER_VENUES.find((v) => v.id === id);

test('tjek-filen er opdateret (koer npm run baner:geo-audit efter ny geokodning)', async () => {
  const fresh = auditVenueCoords(BANER_VENUES_RAW, BANER_VENUE_COORDS, await loadGeocodeCache());
  assert.deepEqual(Object.keys(fresh).sort(), Object.keys(BANER_VENUE_COORDS_QUALITY).sort());
});

test('adresser laeses: postnummer, by og om der er en gadeadresse', () => {
  assert.deepEqual(parseVenueAddress('Sportsvej 5, 9480 , Løkken'), { postal: '9480', city: 'Løkken', noStreet: false });
  assert.deepEqual(parseVenueAddress('Nørresundby — se booking-link'), { postal: null, city: 'Nørresundby', noStreet: true });
});

test('Ingstrup Padelbane ligger ved Løkken, ikke 5 km fra Aalborg', () => {
  const v = byId('matchi_ingstruppadelbane');
  assert.ok(haversineKm(v.latitude, v.longitude, 57.3705, 9.7113) < 15);
  assert.ok(haversineKm(v.latitude, v.longitude, 57.048, 9.919) > 30);
});

test('byer med samme navn: Lynge i Nordsjaelland og Ullerslev paa Fyn', () => {
  const lynge = byId('link_lynge_lynge_uggel_se_if_tennis_og_padel');
  assert.ok(haversineKm(lynge.latitude, lynge.longitude, 55.8395, 12.2748) < 3);
  const ull = byId('link_ullerslev_ullerslev_tennis_klub');
  assert.ok(haversineKm(ull.latitude, ull.longitude, 55.3615, 10.663) < 3);
});

test('centre uden gadeadresse faar kun en pind, hvis kortet kender selve centret', () => {
  // Vestbjerg IF har hverken adresse eller et sted paa kortet under sit navn: kun byens midte.
  assert.equal(byId('link_vestbjerg_vestbjerg_if_tennis_og_padel').coordsApprox, true);
  assert.equal(byId('skansen_ntsc').coordsApprox, undefined);
});

test('navnet paa stedet skal passe med centret, ikke kun med byen eller ordet padel', () => {
  assert.equal(placeNameMatchesVenue('Rocket Padel Esbjerg', 'Rocket Padel Esbjerg', 'Esbjerg'), true);
  assert.equal(placeNameMatchesVenue('Grøndal MultiCenter', 'Grøndal Multicenter', 'København NV'), true);
  assert.equal(placeNameMatchesVenue('Padel Lounge', 'Rocket Padel Nørresundby', 'Nørresundby'), false);
  assert.equal(placeNameMatchesVenue('Svendborg Station', 'Svendborg Padel Klub', 'Svendborg'), false);
  assert.equal(placeNameMatchesVenue('', 'Rocket Padel Esbjerg', 'Esbjerg'), false);
});

test('et center fundet under eget navn faar en praecis pind, men ikke hvis flere deler punktet', () => {
  const venues = [
    { id: 'a', title: 'Rocket Padel Esbjerg', address: 'Esbjerg — se booking-link' },
    { id: 'b', title: 'Sundby Tennisklub', address: 'København S — se booking-link' },
    { id: 'c', title: 'Racket Club Kløver', address: 'København S — se booking-link' },
  ];
  const coords = { a: { lat: 55.5050217, lng: 8.4064154 }, b: { lat: 55.6525, lng: 12.5155 }, c: { lat: 55.6525, lng: 12.5155 } };
  const found = { a: { via: 'name', label: 'Rocket Padel Esbjerg' }, b: { via: 'name', label: 'Sundby Tennisklub' }, c: { via: 'town' } };
  const out = auditVenueCoords(venues, coords, found);
  assert.equal(out.a, undefined);
  assert.equal(out.b?.approx, true);
  assert.equal(out.c?.approx, true);
});

test('et tilfaeldigt sted fundet ved byens navn giver ingen praecis pind', () => {
  const venues = [{ id: 'x', title: 'Match Padel Ballerup', address: 'Ballerup — matchpadel.dk' }];
  const coords = { x: { lat: 55.6497584, lng: 12.1623509 } };
  const out = auditVenueCoords(venues, coords, { x: { via: 'town', label: 'Ballerup Jagtforening' } });
  assert.equal(out.x?.approx, true);
});

test('haandplukkede placeringer: kendte centre, en kilde og enten koordinater eller en adresse', async () => {
  const { default: locations } = await import('../../scripts/data/baner-venue-locations.json', { with: { type: 'json' } });
  const ids = new Set(BANER_VENUES.map((v) => v.id));
  for (const [id, loc] of Object.entries(locations)) {
    assert.ok(ids.has(id), `ukendt center: ${id}`);
    assert.match(loc.source, /^https?:\/\//, `${id} mangler kilde`);
    if (loc.lat != null) {
      assert.ok(loc.lat > 54.5 && loc.lat < 57.8 && loc.lng > 8 && loc.lng < 15.2, `${id} ligger ikke i Danmark`);
    } else {
      assert.match(loc.address, /, \d{4} /, `${id} mangler postnummer i adressen`);
    }
  }
});

test('alle haandplukkede placeringer giver en praecis pind paa kortet', async () => {
  const { default: locations } = await import('../../scripts/data/baner-venue-locations.json', { with: { type: 'json' } });
  for (const id of Object.keys(locations)) {
    assert.equal(byId(id).coordsApprox, undefined, `${id} er stadig "ca."`);
  }
});

test('kendte fejl er rettet: Bornholm, Nykøbing Falster, Skærbæk og Padel Lounge Aarhus', () => {
  const near = (id, lat, lng, km) => {
    const v = byId(id);
    assert.ok(haversineKm(v.latitude, v.longitude, lat, lng) < km, `${id} ligger forkert`);
  };
  near('match_padel_bornholm_inde', 55.1, 14.7, 5); // Rønne, ikke Sjælland
  near('match_padel_nykobing_falster', 54.77, 11.87, 5);
  near('matchi_sk_rb_kpadelogtennis', 55.16, 8.77, 5); // Skærbæk ved Tønder
  near('padel_lounge_aarhus_halbooking', 56.208, 10.176, 1); // Graham Bells Vej, Skejby
});

test('pind langt fra postnummeret regnes for forkert, medmindre geokodningen bekraeftede postnummeret', () => {
  const venues = [{ id: 'x', title: 'Test Padel', address: 'Storegade 46, 6780 , Skærbæk' }];
  const wrong = { x: { lat: 55.58, lng: 9.7 } }; // en anden Skærbæk-agtig placering ved Fredericia
  assert.match(auditVenueCoords(venues, wrong, {}).x?.reason || '', /postnummer 6780/);
  assert.equal(auditVenueCoords(venues, { x: { lat: 55.1586, lng: 8.7598 } }, { x: { via: 'address', postcode: '6780' } }).x, undefined);
});

test('centre, der ikke findes endnu, er ikke med (Rocket Padel Nørresundby er kun planer)', () => {
  assert.equal(BANER_VENUES.some((v) => /rocket padel nørresundby/i.test(v.title)), false);
});
