import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_REGIONS, canonicalAppRegion, isValidAppRegion } from '../../src/lib/appRegions.js';
import {
  getKampeListRegionLabel,
  kampeLevelFilterRangeFromUser,
  matchPassesKampeLevelBandFilter,
  getKampeListLevelBandLabel,
  matchPassesKampeRegionFilter,
  normalizeKampeListFilter,
  profileAreaMatchesKampeRegionFilter,
  resolveCourtNameDirectionsQuery,
  resolveEntityDirectionsQuery,
  resolveMatchDirectionsQuery,
  resolveMatchEffectiveRegion,
  resolveVenueProfileRegion,
  tournamentPassesKampeRegionFilter,
} from '../../src/lib/kampeListFilterCore.js';

test('app har otte landsdele som Baner-fanen', () => {
  assert.equal(APP_REGIONS.length, 8);
  assert.ok(APP_REGIONS.includes('Nordjylland'));
  assert.ok(APP_REGIONS.includes('Bornholm'));
});

test('legacy admin-region migreres til app-landsdel', () => {
  assert.equal(canonicalAppRegion('Region Hovedstaden'), 'Hovedstaden');
  assert.equal(canonicalAppRegion('Region Midtjylland'), 'Østjylland');
  assert.equal(isValidAppRegion('Region Nordjylland'), true);
});

test('region options bruger app-landsdele', () => {
  const f = normalizeKampeListFilter({ regionId: 'Østjylland', eloBandId: '' });
  assert.equal(f.regionId, 'Østjylland');
  assert.equal(getKampeListRegionLabel('Østjylland'), 'Østjylland');
});

test('legacy by-id migreres til landsdel', () => {
  const f = normalizeKampeListFilter({ regionId: 'kbh', eloBandId: '' });
  assert.equal(f.regionId, 'Hovedstaden');
});

test('legacy admin filter-id migreres til landsdel', () => {
  const f = normalizeKampeListFilter({ regionId: 'Region Hovedstaden', eloBandId: '' });
  assert.equal(f.regionId, 'Hovedstaden');
});

test('Skansen Padel mappes til Nordjylland', () => {
  assert.equal(resolveVenueProfileRegion('Skansen Padel'), 'Nordjylland');
});

test('profil-region matcher valgt region', () => {
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Hovedstaden', 'Hovedstaden'),
    true,
  );
  assert.equal(
    profileAreaMatchesKampeRegionFilter('Østjylland', 'Hovedstaden'),
    false,
  );
});

test('kamp uden bane bruger opretterens region', () => {
  const match = {
    court_name: '',
    level_range: 'elo:1200-1300|booked:no',
    creator_id: 'u1',
  };
  const profiles = { u1: { area: 'Hovedstaden' } };
  assert.equal(resolveMatchEffectiveRegion(match, profiles), 'Hovedstaden');
  assert.equal(matchPassesKampeRegionFilter(match, 'Hovedstaden', profiles), true);
  assert.equal(matchPassesKampeRegionFilter(match, 'Nordjylland', profiles), false);
});

test('kamp med bane bruger centerets region (ikke opretter)', () => {
  const match = {
    court_name: 'Skansen Padel',
    level_range: 'elo:1200-1300|booked:yes',
    creator_id: 'u1',
  };
  const profiles = { u1: { area: 'Hovedstaden' } };
  assert.equal(resolveMatchEffectiveRegion(match, profiles), 'Nordjylland');
  assert.equal(matchPassesKampeRegionFilter(match, 'Nordjylland', profiles), true);
  assert.equal(matchPassesKampeRegionFilter(match, 'Hovedstaden', profiles), false);
});

test('legacy elo-bånd migreres væk', () => {
  const f = normalizeKampeListFilter({ regionId: '', eloBandId: '1100-1300' });
  assert.equal(f.eloBandId, '');
});

// Siden 24. sep. 2026: filteret bruger profilens niveau, ikke ELO. En spiller
// med ELO 1075 og niveau 3,5 fik før sine egne 3,2–3,5-kampe sorteret fra.
test('niveau-filter beregnes omkring brugerens niveau', () => {
  assert.deepEqual(kampeLevelFilterRangeFromUser('tight', 3.5), { min: 3, max: 4 });
  assert.equal(getKampeListLevelBandLabel('tight', 3.5), '3.0–4.0');
});

test('niveau-filter overlapper kampens niveau', () => {
  const match = { level_range: 'elo:947-974|booked:no' }; // niveau 3.2–3.5
  assert.equal(matchPassesKampeLevelBandFilter(match, 'tight', 3.5), true);
  assert.equal(matchPassesKampeLevelBandFilter(match, 'tight', 5.0), false);
  assert.equal(matchPassesKampeLevelBandFilter(match, '', 5.0), true);
});

test('turnering med bane filtreres på centerets region', () => {
  assert.equal(
    tournamentPassesKampeRegionFilter(
      { name: 'Fredags turnering' },
      'Nordjylland',
      'Hovedstaden',
      'Skansen Padel',
    ),
    true,
  );
  assert.equal(
    tournamentPassesKampeRegionFilter(
      { name: 'Fredags turnering' },
      'Hovedstaden',
      'Hovedstaden',
      'Skansen Padel',
    ),
    false,
  );
});

test('turnering uden bane filtreres på opretterens region', () => {
  assert.equal(
    tournamentPassesKampeRegionFilter(
      { name: 'Fredags turnering' },
      'Hovedstaden',
      'Hovedstaden',
      'Bane ikke valgt',
    ),
    true,
  );
});

test('rutevejledning bruger banens adresse når centret findes', () => {
  const query = resolveEntityDirectionsQuery({ courtName: 'Skansen Padel', booked: true });
  assert.ok(query);
  assert.match(query, /Nørresundby|Lerumbakken/i);
  assert.match(query, /Denmark/i);
});

test('kamp uden booket bane giver ingen rutevejledning', () => {
  const match = {
    court_name: '',
    level_range: 'elo:1200-1300|booked:no',
    creator_id: 'u1',
  };
  assert.equal(resolveMatchDirectionsQuery(match, { u1: { area: 'Hovedstaden' } }), null);
});

test('kamp med booket bane giver rutevejledning', () => {
  const match = {
    court_name: 'Skansen Padel',
    level_range: 'elo:1200-1300|booked:yes',
    creator_id: 'u1',
  };
  const query = resolveMatchDirectionsQuery(match, { u1: { area: 'Hovedstaden' } });
  assert.ok(query);
  assert.match(query, /Denmark/i);
});

test('Americano-bane giver rutevejledning', () => {
  const query = resolveCourtNameDirectionsQuery('Skansen Padel');
  assert.ok(query);
  assert.match(query, /Denmark/i);
});

test('Bane ikke valgt giver ingen rutevejledning', () => {
  assert.equal(resolveCourtNameDirectionsQuery('Bane ikke valgt'), null);
});
