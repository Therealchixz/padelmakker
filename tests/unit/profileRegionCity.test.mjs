import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const profileUtils = readFileSync(join(dir, '../../src/lib/profileUtils.js'), 'utf8');
const onboarding = readFileSync(join(dir, '../../src/pages/OnboardingPage.jsx'), 'utf8');
const profilTab = readFileSync(join(dir, '../../src/dashboard/ProfilTab.jsx'), 'utf8');
const makkereTab = readFileSync(join(dir, '../../src/dashboard/MakkereTab.jsx'), 'utf8');
const kampeTab = readFileSync(join(dir, '../../src/dashboard/KampeTab.jsx'), 'utf8');
const dash = readFileSync(join(dir, '../../src/dashboard/DashboardPage.jsx'), 'utf8');
const matchFilterPage = readFileSync(join(dir, '../../src/dashboard/MatchSearchFilterPage.jsx'), 'utf8');

test('region påkrævet og by valgfri i onboarding og profil', () => {
  assert.match(profileUtils, /isValidProfileRegion/);
  assert.match(profileUtils, /city: metaCity \|\| null/);
  assert.doesNotMatch(profileUtils, /meta\.area \|\| meta\.region \|\| meta\.city/);
  assert.match(onboarding, /isValidProfileRegion\(form\.area\)/);
  assert.match(onboarding, /Region.*\*.*valgfri/s);
  assert.match(onboarding, /Find makker/);
  assert.match(onboarding, /Kampe/);
  assert.match(makkereTab, /loadError/);
  assert.match(makkereTab, /pm-state-card--error/);
  assert.doesNotMatch(onboarding, /seeking_match/);
  assert.doesNotMatch(onboarding, /intent_now/);
  assert.doesNotMatch(onboarding, /Matchmaking-præferencer/);
  assert.match(profilTab, /Tilføj din by/);
  assert.match(profilTab, /handleQuickCitySave/);
  assert.match(profilTab, /isValidProfileRegion\(region\)/);
});

test('aktiv søgning på Find makker og Kampe', () => {
  assert.match(makkereTab, /ActiveSeekingPanel/);
  assert.match(makkereTab, /channel="makker"/);
  assert.match(kampeTab, /ActiveSeekingPanel/);
  assert.match(kampeTab, /channel="kamp"/);
  assert.match(dash, /PRIMARY_TAB_IDS = \["hjem", "makkere", "baner", "kampe", "ranking", "beskeder"\]/);
  assert.doesNotMatch(dash, /id: "liga",\s*label: "Liga"/);
  assert.match(matchFilterPage, /Hvornår søger du kamp/);
  assert.doesNotMatch(matchFilterPage, /Kun kampe med ledige pladser/);
  assert.doesNotMatch(matchFilterPage, /Hvilke kampe/);
});
