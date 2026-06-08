import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  banerMapsDirectionsUrl,
  banerMapsSearchUrl,
  venueHasMapCoords,
} from '../../src/lib/banerMapLinks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('banerMapsSearchUrl bruger Google Maps search API', () => {
  const url = banerMapsSearchUrl('Lerumbakken 11, 9400 Nørresundby');
  assert.match(url, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.ok(url.includes(encodeURIComponent('Nørresundby')));
});

test('banerMapsDirectionsUrl peger på destination', () => {
  const url = banerMapsDirectionsUrl('Testvej 1, København');
  assert.match(url, /destination=|daddr=/);
});

test('venueHasMapCoords kræver gyldige tal', () => {
  assert.equal(venueHasMapCoords({ latitude: 57.1, longitude: 9.9 }), true);
  assert.equal(venueHasMapCoords({ latitude: null, longitude: 9 }), false);
});

test('BanerTab viser kort-sektion med eksterne links', () => {
  const baner = readFileSync(join(root, 'src/dashboard/BanerTab.jsx'), 'utf8');
  assert.match(baner, /BanerVenueLocation/);
  assert.match(baner, /latitude=\{v\.latitude\}/);
});
