import assert from 'node:assert/strict';
import test from 'node:test';
import { toggleHomeFeedFilter } from '../../src/lib/homeFeedFilters.js';

const ALL = ['kampe', 'americano', 'liga', 'spillere'];

test('fra Alle: klik på Kampe viser kun kampe', () => {
  const next = toggleHomeFeedFilter(new Set(ALL), 'kampe', ALL);
  assert.deepEqual([...next], ['kampe']);
});

test('fra kun kampe: klik på Spillere tilføjer spillere', () => {
  const next = toggleHomeFeedFilter(new Set(['kampe']), 'spillere', ALL);
  assert.deepEqual([...next].sort(), ['kampe', 'spillere']);
});

test('fra kampe+spillere: klik på kampe slår kampe fra', () => {
  const next = toggleHomeFeedFilter(new Set(['kampe', 'spillere']), 'kampe', ALL);
  assert.deepEqual([...next], ['spillere']);
});

test('fra kun kampe: klik på kampe slår kampe fra', () => {
  const next = toggleHomeFeedFilter(new Set(['kampe']), 'kampe', ALL);
  assert.equal(next.size, 0);
});
