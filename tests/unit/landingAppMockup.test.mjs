import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLandingMockupAriaLabel,
  landingMockupLogoSrc,
  landingMockupSteps,
} from '../../src/lib/landingMockupSteps.js';

test('landing mockup explains the full PadelMakker flow without becoming too long', () => {
  assert.equal(landingMockupSteps.length, 5);

  const stepKeys = landingMockupSteps.map((step) => step.key);
  assert.deepEqual(stepKeys, ['profile', 'matches', 'court', 'match', 'elo']);

  for (const step of landingMockupSteps) {
    assert.equal(typeof step.title, 'string');
    assert.ok(step.title.length >= 6);
    assert.ok(step.title.length <= 34, `${step.key} title is too long`);
    assert.ok(step.detail.length <= 52, `${step.key} detail is too long`);
    assert.ok(step.metric.length <= 18, `${step.key} metric is too long`);
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

test('landing mockup uses the current brand logo asset', () => {
  assert.equal(landingMockupLogoSrc, '/logo-brand.png');
});
