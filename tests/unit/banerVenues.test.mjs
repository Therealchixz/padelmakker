import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANER_VENUES,
  BANER_REGION_ORDER,
  groupBanerVenuesByRegion,
} from '../../src/lib/banerVenues.js';
import { BANER_INTEGRATED_INDOOR_VERIFIED } from '../../src/lib/banerVenueIndoorVerified.js';
import { normalizeVenueTitleKey } from '../../src/lib/banerVenueDedup.js';

test('every venue id is unique', () => {
  const ids = BANER_VENUES.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate venue ids');
});

test('every venue has a region and known integration kind', () => {
  const kinds = new Set(['halbooking', 'bookli', 'matchi', 'link']);
  for (const v of BANER_VENUES) {
    assert.ok(v.region, `missing region: ${v.id}`);
    assert.ok(kinds.has(v.kind), `unknown kind: ${v.id}`);
    assert.ok(v.id && v.title);
  }
});

test('groupBanerVenuesByRegion follows BANER_REGION_ORDER', () => {
  const groups = groupBanerVenuesByRegion();
  const regions = groups.map((g) => g.region);
  const orderIdx = (r) => {
    const i = BANER_REGION_ORDER.indexOf(r);
    return i === -1 ? 999 : i;
  };
  for (let i = 1; i < regions.length; i++) {
    assert.ok(
      orderIdx(regions[i]) >= orderIdx(regions[i - 1]),
      `regions out of order: ${regions[i - 1]} then ${regions[i]}`
    );
  }
  const total = groups.reduce((n, g) => n + g.venues.length, 0);
  assert.equal(total, BANER_VENUES.length);
});

test('new Match Padel venues use split ids (not legacy match_padel_halbooking)', () => {
  const ids = BANER_VENUES.map((v) => v.id);
  assert.ok(ids.includes('match_padel_aarhus'));
  assert.ok(ids.includes('match_padel_odense'));
  assert.ok(!ids.includes('match_padel_halbooking'));
});

test('new MATCHi venues are registered', () => {
  const ids = BANER_VENUES.map((v) => v.id);
  assert.ok(ids.includes('matchi_padelnord'));
  assert.ok(ids.includes('matchi_padel8500'));
  assert.ok(ids.includes('matchi_padelland'));
  assert.ok(ids.includes('matchi_padelyard'));
  assert.ok(ids.includes('matchi_padel4alle'));
});

test('Østjylland has more than one integreret center', () => {
  const ost = BANER_VENUES.filter((v) => v.region === 'Østjylland');
  assert.ok(ost.length >= 2, `expected >=2 Østjylland venues, got ${ost.length}`);
  assert.ok(ost.some((v) => v.id === 'matchi_padel8500'));
  assert.ok(ost.some((v) => v.id === 'padelmaster_hadsten'));
});

test('Sjælland and Hovedstaden sections are populated', () => {
  assert.ok(BANER_VENUES.some((v) => v.region === 'Sjælland' && v.kind === 'halbooking'));
  assert.ok(BANER_VENUES.some((v) => v.region === 'Hovedstaden' && v.kind === 'matchi'));
});

test('Sjælland has Padellife links plus multiple integrerede centre', () => {
  const sj = BANER_VENUES.filter((v) => v.region === 'Sjælland');
  const integrated = sj.filter((v) => v.kind !== 'link');
  const links = sj.filter((v) => v.kind === 'link');
  assert.ok(integrated.length >= 14, `expected >=14 integrated Sjælland, got ${integrated.length}`);
  assert.ok(links.length >= 25, `expected >=25 link Sjælland, got ${links.length}`);
  assert.ok(integrated.some((v) => v.id === 'htpk_hillerod_halbooking'));
  assert.ok(integrated.some((v) => v.id === 'match_padel_ballerup'));
  assert.ok(integrated.some((v) => v.id === 'match_padel_naestved'));
});

test('BANER_REGION_ORDER uses DST landsdele including Vestjylland', () => {
  assert.ok(BANER_REGION_ORDER.includes('Vestjylland'));
  assert.ok(BANER_REGION_ORDER.includes('Østjylland'));
  assert.ok(!BANER_REGION_ORDER.includes('Midtjylland'));
  assert.ok(!BANER_REGION_ORDER.includes('Syddanmark'));
});

test('Lemvig and Herning are in Vestjylland', () => {
  const lemvig = BANER_VENUES.find((v) => v.id === 'match_padel_lemvig');
  const herning = BANER_VENUES.find((v) => v.id === 'padel_lounge_herning');
  assert.equal(lemvig?.region, 'Vestjylland');
  assert.equal(herning?.region, 'Vestjylland');
});

test('Padellife link catalog covers all regions', () => {
  for (const region of BANER_REGION_ORDER) {
    assert.ok(
      BANER_VENUES.some((v) => v.region === region),
      `missing any venue in ${region}`
    );
  }
});

test('integrerede baner matcher verificeret indoor/outdoor-katalog', () => {
  for (const [id, indoor] of Object.entries(BANER_INTEGRATED_INDOOR_VERIFIED)) {
    const v = BANER_VENUES.find((x) => x.id === id);
    assert.ok(v, `missing venue ${id}`);
    assert.equal(v.indoor, indoor, `${id}: forventet ${indoor ? 'indoor' : 'outdoor'}`);
  }
});

test('Sæby Spektrum er Halbooking (ikke kun Padellife-link)', () => {
  const saeby = BANER_VENUES.filter(
    (v) => normalizeVenueTitleKey(v.title).includes('sæby spektrum') || v.id === 'sportshallen_frederikshavn_halbooking'
  );
  assert.ok(saeby.some((v) => v.kind === 'halbooking' && v.id === 'sportshallen_frederikshavn_halbooking'));
  assert.ok(!saeby.some((v) => v.kind === 'link' && /sæby spektrum/i.test(v.title)));
});

test('Padellife-link med samme navn som integreret center filtreres fra', () => {
  const dup = BANER_VENUES.filter((v) => normalizeVenueTitleKey(v.title) === 'padel lounge aalborg');
  assert.equal(dup.length, 1, `forventet én Padel Lounge Aalborg, fik ${dup.length}: ${dup.map((v) => v.id).join(', ')}`);
  assert.equal(dup[0].kind, 'halbooking');
  assert.equal(dup[0].id, 'padel_lounge_aalborg');
});

test('Skagen Padelcenter er indendørs (MATCHi: Padel INDOORS)', () => {
  const skagen = BANER_VENUES.find((v) => v.id === 'matchi_skagen_padelcenter');
  assert.equal(skagen?.indoor, true);
  assert.match(skagen?.bookingUrl || '', /SkagenPadelcenter$/);
});

test('Odense is on Fyn; Sønderjylland has southern Jutland venues', () => {
  const odense = BANER_VENUES.find((v) => v.id === 'match_padel_odense');
  assert.equal(odense?.region, 'Fyn');
  assert.ok(BANER_REGION_ORDER.includes('Fyn'));
  assert.ok(BANER_REGION_ORDER.includes('Sønderjylland'));
  assert.ok(!BANER_REGION_ORDER.includes('Syddanmark'));
  const sonder = BANER_VENUES.filter((v) => v.region === 'Sønderjylland');
  assert.ok(sonder.length >= 2);
});
