import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const matchSrc = readFileSync(join(root, 'src/lib/makkerFilterMatch.js'), 'utf8');
const coreSrc = readFileSync(join(root, 'src/lib/makkerSearchFilterCore.js'), 'utf8');

test('makkerFilterMatch exports v2 matching helpers', () => {
  assert.match(matchSrc, /courtSideMatchesMakkerFilter/);
  assert.match(matchSrc, /playStyleMatchesMakkerFilter/);
  assert.match(matchSrc, /intentMatchesMakkerFilter/);
  assert.match(matchSrc, /availabilityMatchesMakkerFilter/);
  assert.match(matchSrc, /levelRangeForMakkerPartnerPref/);
  assert.match(matchSrc, /MAKKER_PARTNER_LEVEL_FILTERS/);
  assert.match(matchSrc, /normalizeIntent\(k\)/);
});

test('makkerSearchFilterCore wires extras into seekingProfileMatchesFilter', () => {
  assert.match(coreSrc, /MAKKER_FILTER_PREFS_VERSION = 2/);
  assert.match(coreSrc, /courtSideMatchesMakkerFilter/);
  assert.match(coreSrc, /subjectPassesMakkerLevelFilter/);
  assert.match(coreSrc, /levelRangeForMakkerPartnerPref/);
});
