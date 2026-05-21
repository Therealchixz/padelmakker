import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('PlaytomicLevelPicker supports fine-tuned decimal level', () => {
  const src = readFileSync(join(root, 'src/components/PlaytomicLevelPicker.jsx'), 'utf8');
  assert.match(src, /step=\{0\.1\}/);
  assert.match(src, /Finjuster dit niveau/);
  assert.match(src, /type="number"/);
});

test('onboarding and profil use levelNumeric', () => {
  const onboarding = readFileSync(join(root, 'src/pages/OnboardingPage.jsx'), 'utf8');
  const profil = readFileSync(join(root, 'src/dashboard/ProfilTab.jsx'), 'utf8');
  assert.match(onboarding, /levelNumeric/);
  assert.match(onboarding, /PlaytomicLevelPicker/);
  assert.match(profil, /levelNumeric/);
  assert.match(profil, /PlaytomicLevelPicker/);
});

test('levelMatchesPreset treats 3.3 as advanced band', () => {
  const constants = readFileSync(join(root, 'src/lib/platformConstants.js'), 'utf8');
  assert.match(constants, /levelMatchesPreset/);
  assert.match(constants, /levelPresetBand/);
});
