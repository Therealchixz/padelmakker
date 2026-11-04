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
  assert.equal(landingEloScoreExample.newElo, 1065);
  assert.equal(landingEloScoreExample.delta, 25);
  assert.equal(formatEloDelta(landingEloScoreExample.delta), '+25 ELO');
});

test('landing page uses live public data and the v4 scroll story', async () => {
  const landingPage = await readFile(new URL('../../src/pages/LandingPage.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../src/styles/landing.css', import.meta.url), 'utf8');

  assert.match(landingPage, /fetchLandingPublicStats/);
  assert.match(landingPage, /public_upcoming_americano_events/);
  assert.match(landingPage, /Inviter en ven/);
  assert.match(landingPage, /LANDING_STORY_STEPS/);
  assert.match(css, /\.pm-lp-story-stick\s*\{[^}]*position:\s*sticky/);
  assert.match(css, /prefers-reduced-motion/);
});

test('roadmap lives on /om (not the landing page) and avoids date promises', async () => {
  const landingPage = await readFile(new URL('../../src/pages/LandingPage.jsx', import.meta.url), 'utf8');
  const omPage = await readFile(new URL('../../src/pages/OmPage.jsx', import.meta.url), 'utf8');

  // Forsiden skal være kort: køreplanen og funktions-gitteret er flyttet væk.
  assert.doesNotMatch(landingPage, /LandingRoadmap/);
  assert.doesNotMatch(landingPage, /pm-landing-features-grid/);
  assert.match(omPage, /Det arbejder vi på/);
  assert.match(omPage, /ROADMAP_NEXT/);
  assert.doesNotMatch(omPage, /20\d{2}|Q[1-4]|kommer næste måned/i);
});

test('landing ELO count-up is slow and replays on every fresh page load', async () => {
  const component = await readFile(new URL('../../src/components/LandingEloExplainer.jsx', import.meta.url), 'utf8');

  assert.ok(landingEloAnimationConfig.durationMs >= 2500);
  assert.ok(landingEloAnimationConfig.durationMs <= 3500);
  assert.ok(landingEloAnimationConfig.startDelayMs >= 200);
  assert.equal('sessionStorageKey' in landingEloAnimationConfig, false);
  assert.doesNotMatch(component, /sessionStorage/);
});

test('landing CTA buttons keep strong contrast', async () => {
  const css = await readFile(new URL('../../src/styles/landing.css', import.meta.url), 'utf8');
  // Hvid tekst paa lerfarven (#C0503A) giver 4,7:1; den lysere #C8553D gav kun 4,35:1.
  assert.match(css, /--lp-clay-solid:\s*#C0503A/);
  assert.match(css, /\.pm-lp-cta\s*\{[^}]*background:\s*var\(--lp-clay-solid\)/);
});
