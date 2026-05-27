import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getKampeListRegionLabel,
  kampeEloFilterRangeFromUser,
  matchPassesKampeEloBandFilter,
  matchPassesKampeRegionFilter,
  normalizeKampeListFilter,
  profileAreaMatchesKampeRegionFilter,
  resolveMatchEffectiveRegion,
  resolveVenueProfileRegion,
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

test('Skansen Padel mappes til Region Nordjylland', () => {
  assert.equal(resolveVenueProfileRegion('Skansen Padel'), 'Region Nordjylland');
});

test('profil-region matcher valgt region', () => {
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Region Hovedstaden', 'Region Hovedstaden'),
    true,
  );
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Region Midtjylland', 'Region Hovedstaden'),
    false,
  );
});

test('kamp uden bane bruger opretterens region', () => {
  const match = {
    court_name: '',
    level_range: 'elo:1200-1300|booked:no',
    creator_id: 'u1',
  };
  const profiles = { u1: { area: 'Region Hovedstaden' } };
  assert.equal(resolveMatchEffectiveRegion(match, profiles), 'Region Hovedstaden');
  assert.equal(matchPassesKampeRegionFilter(match, 'Region Hovedstaden', profiles), true);
  assert.equal(matchPassesKampeRegionFilter(match, 'Region Nordjylland', profiles), false);
});

test('kamp med bane bruger centerets region (ikke opretter)', () => {
  const match = {
    court_name: 'Skansen Padel',
    level_range: 'elo:1200-1300|booked:yes',
    creator_id: 'u1',
  };
  const profiles = { u1: { area: 'Region Hovedstaden' } };
  assert.equal(resolveMatchEffectiveRegion(match, profiles), 'Region Nordjylland');
  assert.equal(matchPassesKampeRegionFilter(match, 'Region Nordjylland', profiles), true);
  assert.equal(matchPassesKampeRegionFilter(match, 'Region Hovedstaden', profiles), false);
});

test('legacy elo-bånd migreres væk', () => {
  const f = normalizeKampeListFilter({ regionId: '', eloBandId: '1100-1300' });
  assert.equal(f.eloBandId, '');
});

test('ELO-filter beregnes omkring brugerens rating', () => {
  assert.deepEqual(kampeEloFilterRangeFromUser('tight', 1250), { min: 1150, max: 1350 });
});

test('ELO-filter overlapper kamp-interval relativt til bruger', () => {
  const match = { level_range: 'elo:1200-1400|booked:yes' };
  assert.equal(matchPassesKampeEloBandFilter(match, 'tight', 1250), true);
  assert.equal(matchPassesKampeEloBandFilter(match, 'tight', 900), false);
});

test('turnering med bane filtreres på centerets region', () => {
  assert.equal(
    tournamentPassesKampeRegionFilter(
      { name: 'Fredags turnering' },
      'Region Nordjylland',
      'Region Hovedstaden',
      'Skansen Padel',
    ),
    true,
  );
  assert.equal(
    tournamentPassesKampeRegionFilter(
      { name: 'Fredags turnering' },
      'Region Hovedstaden',
      'Region Hovedstaden',
      'Skansen Padel',
    ),
    false,
  );
});

test('turnering uden bane filtreres på opretterens region', () => {
  assert.equal(
    tournamentPassesKampeRegionFilter(
      { name: 'Fredags turnering' },
      'Region Hovedstaden',
      'Region Hovedstaden',
      'Bane ikke valgt',
    ),
    true,
  );
});
