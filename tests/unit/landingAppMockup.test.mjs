import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import {
  getLandingMockupAriaLabel,
  landingMockupBrand,
  landingMockupCarouselScreens,
  landingMockupScreens,
} from '../../src/lib/landingMockupSteps.js';

test('landing mockup carousel explains the full PadelMakker flow without becoming too long', () => {
  assert.equal(landingMockupScreens.length, 4);

  const screenKeys = landingMockupScreens.map((screen) => screen.key);
  assert.deepEqual(screenKeys, ['profile', 'matches', 'booking', 'elo']);

  for (const screen of landingMockupScreens) {
    assert.equal(typeof screen.title, 'string');
    assert.ok(screen.title.length >= 6);
    assert.ok(screen.title.length <= 34, `${screen.key} title is too long`);
    assert.ok(screen.detail.length <= 58, `${screen.key} detail is too long`);
    assert.ok(screen.metric.length <= 18, `${screen.key} metric is too long`);
    assert.ok(screen.cards.length >= 2, `${screen.key} needs enough content cards`);
    assert.ok(screen.cards.length <= 3, `${screen.key} should stay visually calm`);
  }
});

test('landing mockup carousel repeats the first screen at the end for a smooth visual loop', () => {
  assert.equal(landingMockupCarouselScreens.length, landingMockupScreens.length + 1);

  const firstScreen = landingMockupScreens[0];
  const loopScreen = landingMockupCarouselScreens.at(-1);

  assert.equal(loopScreen.isLoopClone, true);
  assert.equal(loopScreen.sourceKey, firstScreen.key);
  assert.equal(loopScreen.title, firstScreen.title);
  assert.equal(loopScreen.detail, firstScreen.detail);
  assert.equal(loopScreen.metric, firstScreen.metric);
});

test('landing mockup reset is controlled by React to avoid mobile repaint flashes', async () => {
  const css = await readFile(new URL('../../src/responsive.css', import.meta.url), 'utf8');
  const component = await readFile(new URL('../../src/components/AnimatedAppMockup.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(css, /@keyframes pmMockupSlide/);
  assert.doesNotMatch(css, /animation:\s*pmMockupSlide/);
  assert.match(css, /will-change:\s*transform;/);
  assert.match(component, /onTransitionEnd=\{handleTrackTransitionEnd\}/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /transitionEnabled/);
  assert.match(component, /translate3d/);
});

test('landing mockup has a concise screen reader summary', () => {
  const label = getLandingMockupAriaLabel();

  assert.match(label, /profil/i);
  assert.match(label, /makker/i);
  assert.match(label, /bane/i);
  assert.match(label, /ELO/i);
  assert.ok(label.length <= 180, `aria label should stay concise, got ${label.length} characters`);
});

test('landing mockup uses simple text branding instead of a logo image', () => {
  assert.deepEqual(landingMockupBrand, {
    nameLines: ['PADEL', 'MAKKER'],
    tagline: 'FIND DIN PERFEKTE MAKKER',
  });
});
