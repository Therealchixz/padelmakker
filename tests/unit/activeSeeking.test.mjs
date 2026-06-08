import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const activeSeeking = readFileSync(join(root, 'src/lib/activeSeeking.js'), 'utf8');
const panel = readFileSync(join(root, 'src/components/ActiveSeekingPanel.jsx'), 'utf8');
const onboarding = readFileSync(join(root, 'src/components/ActiveSeekingOnboardingPrompt.jsx'), 'utf8');

test('activeSeeking kombinerer feedVisible og notify i én switch', () => {
  assert.match(activeSeeking, /isCombinedSeekingEnabled/);
  assert.match(activeSeeking, /isSeekingUiActive/);
  assert.match(activeSeeking, /buildExpiredSeekingSyncPatch/);
  assert.match(activeSeeking, /formatSeekingTtlCountdown/);
  assert.match(activeSeeking, /filterSummary/);
  assert.match(activeSeeking, /prefs\.feedVisible && prefs\.notify/);
  assert.match(activeSeeking, /feedVisible: true,\s*\n\s*notify: true/s);
  assert.match(activeSeeking, /feedVisible: false,\s*\n\s*notify: false/s);
  assert.match(activeSeeking, /buildSeekingProfilePatch/);
  assert.match(activeSeeking, /canonicalRegionForForm\(user\?\.area\)/);
});

test('ActiveSeekingPanel har home dropdown og compact med optimistisk state', () => {
  assert.match(panel, /variant === 'compact'/);
  assert.match(panel, /homeExpanded/);
  assert.match(panel, /homeExpanded/);
  assert.match(panel, /isSeekingUiActive/);
  assert.match(panel, /localUser/);
  assert.match(panel, /updateProfile/);
  assert.match(panel, /describeActiveSeeking/);
  assert.match(panel, /notifyMakkerWatchersForProfile/);
  assert.match(panel, /pm-active-seeking-filter/);
  assert.match(panel, /SeekingTtlCountdown/);
  assert.doesNotMatch(panel, /Juster makker-kriterier/);
});

test('onboarding-prompt tilbyder begge kanaler med profil-defaults', () => {
  assert.match(onboarding, /buildSeekingProfilePatch/);
  assert.match(onboarding, /pm-active-seeking-onboarding-v1/);
  assert.match(onboarding, /makker og kamp/);
});

test('ActiveSeekingPanel integreret på Hjem, Makkere og Kampe', () => {
  const home = readFileSync(join(root, 'src/dashboard/HomeTab.jsx'), 'utf8');
  const makkere = readFileSync(join(root, 'src/dashboard/MakkereTab.jsx'), 'utf8');
  const kampe = readFileSync(join(root, 'src/dashboard/KampeTab.jsx'), 'utf8');
  assert.match(home, /ActiveSeekingPanel/);
  assert.match(home, /variant="home"/);
  assert.match(home, /ActiveSeekingOnboardingPrompt/);
  assert.match(makkere, /ActiveSeekingPanel/);
  assert.match(makkere, /channel="makker"/);
  assert.match(kampe, /ActiveSeekingPanel/);
  assert.match(kampe, /channel="kamp"/);
});

test('filter-sider uden Kanaler-sektion; KampeFilterSheet uden søger-toggle', () => {
  const makkerPage = readFileSync(join(root, 'src/dashboard/MakkerSearchFilterPage.jsx'), 'utf8');
  const matchPage = readFileSync(join(root, 'src/dashboard/MatchSearchFilterPage.jsx'), 'utf8');
  const sheet = readFileSync(join(root, 'src/components/kampe/KampeFilterSheet.jsx'), 'utf8');
  assert.doesNotMatch(makkerPage, /Kanaler/);
  assert.doesNotMatch(matchPage, /Kanaler/);
  assert.match(makkerPage, /Dette styrer hvornår du får besked/);
  assert.match(matchPage, /Dette styrer hvornår du får besked/);
  assert.doesNotMatch(sheet, /Søger kamp/);
  assert.doesNotMatch(sheet, /showSeekingToggle/);
});
