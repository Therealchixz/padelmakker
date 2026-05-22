import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANER_VENUES,
  BANER_REGION_ORDER,
  groupBanerVenuesByRegion,
} from '../../src/lib/banerVenues.js';

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
});
