import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (rel) => readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('aktiv-søgning-vinduet venter, mens velkomst/rundvisning kører', async () => {
  const prompt = await read('src/components/ActiveSeekingOnboardingPrompt.jsx');
  assert.match(prompt, /deferred = false/);
  assert.match(prompt, /if \(!open \|\| !showToast \|\| deferred\) return null;/);

  const home = await read('src/dashboard/HomeTab.jsx');
  assert.match(home, /<ActiveSeekingOnboardingPrompt[^>]*deferred=\{deferOnboardingPrompt\}/);

  const dash = await read('src/dashboard/DashboardPage.jsx');
  assert.match(dash, /deferOnboardingPrompt=\{onboardingThisVisit \|\| welcomeOpen \|\| tourOpen\}/);
});

test('aktiv-søgning-vinduet siger tydeligt, at man bliver synlig', async () => {
  const prompt = await read('src/components/ActiveSeekingOnboardingPrompt.jsx');
  assert.match(prompt, /Andre spillere kan se dig under Find makker/);
  assert.match(prompt, /Ja, vis mig som makker/);
  assert.doesNotMatch(prompt, /'Ja, giv mig besked'/);
});

test('cookie-baren dækker ikke velkomstskærmens knap', async () => {
  const bar = await read('src/components/CookieNoticeBar.jsx');
  assert.match(bar, /--pm-cookie-bar-h/);
  const welcome = await read('src/components/WelcomeScreen.jsx');
  assert.match(welcome, /var\(--pm-cookie-bar-h, 0px\)/);
});

test('Hjem viser kun én hjælpeboks ad gangen', async () => {
  const home = await read('src/dashboard/HomeTab.jsx');
  assert.match(home, /showNiveauEloHint && !showIosInstallHint &&/);
});
