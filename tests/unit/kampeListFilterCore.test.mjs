import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchPassesKampeEloBandFilter,
  matchPassesKampeRegionFilter,
  textMatchesKampeRegionFilter,
  tournamentPassesKampeRegionFilter,
} from '../../src/lib/kampeListFilterCore.js';

test('region filter matcher bane-navn', () => {
  assert.equal(
    textMatchesKampeRegionFilter(['Padel Zone København'], 'kbh'),
    true,
  );
  assert.equal(
    textMatchesKampeRegionFilter(['Padel Zone Aarhus'], 'kbh'),
    false,
  );
});

test('ELO-bånd overlapper kamp-interval', () => {
  const match = { level_range: 'elo:1200-1400|booked:yes' };
  assert.equal(matchPassesKampeEloBandFilter(match, '1100-1300'), true);
  assert.equal(matchPassesKampeEloBandFilter(match, '800-1100'), false);
});

test('turnering filtreres på bane-navn', () => {
  assert.equal(
    tournamentPassesKampeRegionFilter({ name: 'Fredags turnering' }, 'odense', 'Odense Padel'),
    true,
  );
});

test('match region via opretters område', () => {
  const match = { court_name: 'Ukendt bane', creator_id: 'u1' };
  const profiles = { u1: { area: 'Aarhus' } };
  assert.equal(matchPassesKampeRegionFilter(match, 'aarhus', profiles), true);
});
