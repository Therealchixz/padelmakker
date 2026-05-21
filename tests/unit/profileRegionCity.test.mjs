import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const profileUtils = readFileSync(join(dir, '../../src/lib/profileUtils.js'), 'utf8');
const onboarding = readFileSync(join(dir, '../../src/pages/OnboardingPage.jsx'), 'utf8');
const profilTab = readFileSync(join(dir, '../../src/dashboard/ProfilTab.jsx'), 'utf8');

test('region påkrævet og by valgfri i onboarding og profil', () => {
  assert.match(profileUtils, /isValidProfileRegion/);
  assert.match(profileUtils, /city: metaCity \|\| null/);
  assert.doesNotMatch(profileUtils, /meta\.area \|\| meta\.region \|\| meta\.city/);
  assert.match(onboarding, /isValidProfileRegion\(form\.area\)/);
  assert.match(onboarding, /Region.*\*.*valgfri/s);
  assert.match(onboarding, /Mit kamp-filter/);
  assert.doesNotMatch(onboarding, /seeking_match/);
  assert.doesNotMatch(onboarding, /intent_now/);
  assert.doesNotMatch(onboarding, /Matchmaking-præferencer/);
  assert.match(profilTab, /Tilføj din by/);
  assert.match(profilTab, /handleQuickCitySave/);
  assert.match(profilTab, /isValidProfileRegion\(region\)/);
});
