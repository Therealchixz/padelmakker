import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listShareableCourts,
  mapBanerVenueToShareableCourt,
} from '../../src/lib/chatVenueShareUtils.js';

test('listShareableCourts returns baner catalog venues with booking links', () => {
  const rows = listShareableCourts(5);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.id && row.name));
  assert.ok(rows.every((row) => typeof row.city === 'string'));
});

test('mapBanerVenueToShareableCourt maps link venues with external booking URL', () => {
  const row = mapBanerVenueToShareableCourt({
    kind: 'link',
    id: 'test_venue',
    title: 'Test Padel',
    address: 'Testvej 1',
    region: 'Hovedstaden',
    indoor: true,
    bookingUrl: 'https://example.com/book',
  });
  assert.equal(row.name, 'Test Padel');
  assert.equal(row.city, 'Hovedstaden');
  assert.equal(row.booking_url, 'https://example.com/book');
});
