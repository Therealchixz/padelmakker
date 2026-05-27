import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getKampeListRegionLabel,
  matchPassesKampeEloBandFilter,
  matchPassesKampeRegionFilter,
  normalizeKampeListFilter,
  profileAreaMatchesKampeRegionFilter,
  tournamentPassesKampeRegionFilter,
} from '../../src/lib/kampeListFilterCore.js';

test('region options bruger danske regioner', () => {
  const f = normalizeKampeListFilter({ regionId: 'Region Midtjylland', eloBandId: '' });
  assert.equal(f.regionId, 'Region Midtjylland');
  assert.equal(getKampeListRegionLabel('Region Midtjylland'), 'Midtjylland');
});

test('legacy by-id migreres til region', () => {
  const f = normalizeKampeListFilter({ regionId: 'kbh', eloBandId: '' });
  assert.equal(f.regionId, 'Region Hovedstaden');
});

test('profil-region matcher valgt region', () => {
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Region Hovedstaden', 'Region Hovedstaden'),
    true,
  );
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Nordjylland', 'Region Nordjylland'),
    true,
  );
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Region Midtjylland', 'Region Hovedstaden'),
    false,
  );
});

test('ELO-bånd overlapper kamp-interval', () => {
  const match = { level_range: 'elo:1200-1400|booked:yes' };
  assert.equal(matchPassesKampeEloBandFilter(match, '1100-1300'), true);
  assert.equal(matchPassesKampeEloBandFilter(match, '800-1100'), false);
});

test('turnering filtreres på opretters region', () => {
  assert.equal(
    tournamentPassesKampeRegionFilter({ name: 'Fredags turnering' }, 'Region Syddanmark', 'Syddanmark'),
    true,
  );
  assert.equal(
    tournamentPassesKampeRegionFilter({ name: 'Fredags turnering' }, 'Region Hovedstaden', 'Syddanmark'),
    false,
  );
});

test('match region via opretters profil-area', () => {
  const match = { court_name: 'Padel Zone København', creator_id: 'u1' };
  const profiles = { u1: { area: 'Region Midtjylland' } };
  assert.equal(matchPassesKampeRegionFilter(match, 'Region Midtjylland', profiles), true);
  assert.equal(matchPassesKampeRegionFilter(match, 'Region Hovedstaden', profiles), false);
});
