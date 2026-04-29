import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import {
  formatEloDelta,
  landingEloAnimationConfig,
  landingEloExplainerSteps,
  landingEloScoreExample,
} from '../../src/lib/landingEloExplainer.js';

test('landing ELO explainer uses a concise match story with a visible rating change', () => {
  assert.equal(landingEloExplainerSteps.length, 3);
  assert.deepEqual(landingEloExplainerSteps.map((step) => step.key), ['before', 'match', 'after']);

  assert.equal(landingEloScoreExample.playerName, 'Karl');
  assert.equal(landingEloScoreExample.oldElo, 1040);
  assert.equal(landingEloScoreExample.newElo, 1058);
  assert.equal(landingEloScoreExample.delta, 18);
  assert.equal(formatEloDelta(landingEloScoreExample.delta), '+18 ELO');
});

test('landing page includes the ELO explainer and scroll-reveal flow styling', async () => {
  const landingPage = await readFile(new URL('../../src/pages/LandingPage.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../src/responsive.css', import.meta.url), 'utf8');

  assert.match(landingPage, /<LandingEloExplainer/);
  assert.match(landingPage, /pm-landing-step-flow/);
  assert.match(css, /\.pm-landing-step-flow\.pm-visible::before/);
  assert.match(css, /\.pm-elo-explainer-card\.pm-visible/);
  assert.match(css, /\.pm-landing-elo-section[\s\S]*linear-gradient\(180deg,\s*var\(--pm-bg\) 0%/);
  assert.doesNotMatch(css, /\.pm-landing-elo-section[\s\S]{0,320}border-top:/);
  assert.match(css, /@keyframes pmEloDeltaPop/);
});

test('landing ELO count-up is slow and replays on every fresh page load', async () => {
  const component = await readFile(new URL('../../src/components/LandingEloExplainer.jsx', import.meta.url), 'utf8');

  assert.ok(landingEloAnimationConfig.durationMs >= 2500);
  assert.ok(landingEloAnimationConfig.durationMs <= 3500);
  assert.ok(landingEloAnimationConfig.startDelayMs >= 200);
  assert.equal('sessionStorageKey' in landingEloAnimationConfig, false);
  assert.doesNotMatch(component, /sessionStorage/);
});
