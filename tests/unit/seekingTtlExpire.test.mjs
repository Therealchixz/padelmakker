import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Spejler seekingFeedTtl.isChannelFeedWithinTtl (nu med nowMs til test). */
function isChannelFeedWithinTtl(sinceMs, ttlMs, nowMs = Date.now()) {
  if (sinceMs == null) return false;
  return nowMs - sinceMs < ttlMs;
}

test('kamp-TTL (24t) udløber efter 24 timer', () => {
  const since = Date.parse('2026-06-01T12:00:00.000Z');
  const ttl = DAY;
  assert.equal(isChannelFeedWithinTtl(since, ttl, since + DAY - 1), true);
  assert.equal(isChannelFeedWithinTtl(since, ttl, since + DAY), false);
  assert.equal(isChannelFeedWithinTtl(since, ttl, since + 2 * DAY), false);
});

test('makker-TTL (7 dage) udløber efter 7 dage', () => {
  const since = Date.parse('2026-06-01T12:00:00.000Z');
  const ttl = 7 * DAY;
  assert.equal(isChannelFeedWithinTtl(since, ttl, since + 6 * DAY), true);
  assert.equal(isChannelFeedWithinTtl(since, ttl, since + 7 * DAY), false);
});

test('activeSeeking slår fra ved udløbet TTL og fornyer feedVisibleSince', () => {
  const src = readFileSync(join(root, 'src/lib/activeSeeking.js'), 'utf8');
  const panel = readFileSync(join(root, 'src/components/ActiveSeekingPanel.jsx'), 'utf8');
  const css = readFileSync(join(root, 'src/responsive.css'), 'utf8');
  assert.match(src, /isSeekingUiActive/);
  assert.match(src, /isSeekingTtlExpired/);
  assert.match(src, /buildExpiredSeekingSyncPatch/);
  assert.match(src, /formatSeekingTtlCountdown/);
  assert.match(src, /buildActiveSeekingFilterSummary/);
  assert.match(src, /seekingAvailabilitySummary/);
  assert.match(src, /filterSummary/);
  assert.match(src, /feedVisibleSince: new Date\(\)\.toISOString\(\)/);
  assert.match(panel, /buildExpiredSeekingSyncPatch/);
  assert.match(panel, /checked=\{active\}/);
  assert.match(panel, /pm-active-seeking-filter/);
  assert.match(panel, /SeekingTtlCountdown/);
  assert.doesNotMatch(panel, /Juster makker-kriterier/);
  assert.doesNotMatch(panel, /countdown-track/);
  assert.match(panel, /homeExpanded/);
  assert.match(panel, /Online/);
  assert.match(css, /\.pm-active-seeking-countdown/);
  assert.doesNotMatch(css, /\.pm-active-seeking-countdown-track/);
});

test('compact panel uden hvid wrapper-section', () => {
  const panel = readFileSync(join(root, 'src/components/ActiveSeekingPanel.jsx'), 'utf8');
  assert.match(panel, /if \(variant === 'compact'\)/);
  assert.match(panel, /channels\.map\(renderRow\)/);
});
