import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLandingMockupAriaLabel,
  landingMockupBrand,
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
