import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../../src/lib/seekingActivityLabel.js'), 'utf8');
const ttlSrc = readFileSync(join(dir, '../../src/lib/seekingFeedTtl.js'), 'utf8');
const constantsSrc = readFileSync(join(dir, '../../src/lib/platformConstants.js'), 'utf8');

test('seekingActivityLabel skelner kamp, makker og begge', () => {
  assert.match(src, /søger kamp og makker/);
  assert.match(src, /if \(makkerOn\) return 'søger makker'/);
  assert.match(src, /if \(matchOn\) return 'søger kamp'/);
  assert.match(src, /getPlayerSeekingDetails\(profile, opts/);
  assert.match(src, /opts\.channel/);
  assert.match(src, /compactMatchSeekingDetails/);
  assert.match(src, /compactMakkerSeekingDetails/);
  assert.match(src, /details:/);
  assert.doesNotMatch(src, /describeMatchFilter/);
  assert.doesNotMatch(src, /intentLabel/);
});

test('adskilt TTL: kamp 24 timer, makker 7 dage', () => {
  assert.match(constantsSrc, /SEEK_KAMP_TTL_DAYS = 1/);
  assert.match(constantsSrc, /SEEK_MAKKER_TTL_DAYS = 7/);
  assert.match(ttlSrc, /SEEK_KAMP_TTL_MS/);
  assert.match(ttlSrc, /SEEK_MAKKER_TTL_MS/);
  assert.match(ttlSrc, /feedVisibleSince/);
});

test('kamp-detaljer inkluderer tidsrum', () => {
  assert.match(ttlSrc, /compactMatchSeekingDetails/);
  assert.match(ttlSrc, /pushSeekingDetail\(lines, 'Tidsrum', seekingAvailabilitySummary/);
});

test('makker-detaljer inkluderer filterfelter', () => {
  assert.match(ttlSrc, /compactMakkerSeekingDetails/);
  assert.match(ttlSrc, /Banehalvdel/);
  assert.match(ttlSrc, /Intention/);
  assert.match(ttlSrc, /Alle tidsrum/);
  assert.match(ttlSrc, /Tidsrum/);
  assert.match(ttlSrc, /makkerPartnerLevelDisplayLabel/);
  assert.match(ttlSrc, /PARTNER_LEVEL_LABELS\[effective\]/);
});

test('aktivitetsfeed: én række pr. kanal', () => {
  assert.match(ttlSrc, /expandProfilesToSeekingFeedRows/);
  assert.match(ttlSrc, /seekingChannel: 'kamp'/);
  assert.match(ttlSrc, /seekingChannel: 'makker'/);
  assert.match(src, /seekingActivityLabelForRow/);
});
