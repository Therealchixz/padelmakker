import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// Ejeren 17. nov. 2026: Kort viste først kortet over baner og skiftede så til kampene.
test('Kort viser en pladsholder, mens kampene hentes (ikke kortet over baner)', () => {
  const src = read('src/dashboard/KampeTab.jsx');
  const loadingAt = src.indexOf(') : loadingMatches ? (');
  const overviewAt = src.indexOf('<KortOverviewLazy');
  const nearbyAt = src.indexOf('<KortNearbyMapLazy');
  assert.ok(loadingAt > 0 && loadingAt < overviewAt && overviewAt < nearbyAt);
  assert.match(src, /count: loadingMatches \? null :/);
});

// level_range gemmes som "elo:833-900|booked:no" og maa aldrig vises raat.
test('Kort viser kampens niveau som tal, ikke den gemte kode', () => {
  const src = read('src/dashboard/KampeTab.jsx');
  assert.doesNotMatch(src, /String\(m\.level_range\)\.replace/);
  assert.match(src, /parseMatchLevelRange\(m\.level_range\)/);
});
