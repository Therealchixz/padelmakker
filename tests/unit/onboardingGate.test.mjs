import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const profileUtilsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/lib/profileUtils.js',
);

test('isOnboardingComplete gates on profile fields, not JWT metadata bypass', () => {
  const src = readFileSync(profileUtilsPath, 'utf8');
  const fnBlock = src.slice(
    src.indexOf('export function isOnboardingComplete'),
    src.indexOf('function isGenericProfileName'),
  );
  assert.doesNotMatch(fnBlock, /onboarding_completed/);
  assert.match(fnBlock, /return birthOk && styleOk/);
});

test('adgangstjekket kræver ikke mere end opret-siden (gennemgang 3. nov. 2026)', async () => {
  const { isOnboardingComplete, canAccessDashboard } = await import('../../src/lib/profileUtils.js');
  const user = { id: 'u1' };
  // "Ved ikke endnu" er et valg på opret-siden, og tidspunkter er valgfri.
  const profile = { birth_year: 1995, play_style: 'Ved ikke endnu', availability: [] };
  assert.equal(isOnboardingComplete(user, profile), true);
  assert.equal(canAccessDashboard(user, profile), true);
  // En tom profil (fx oprettet før opret-siden er udfyldt) er stadig ikke færdig.
  assert.equal(isOnboardingComplete(user, { birth_year: null, play_style: 'Ved ikke endnu', availability: [] }), false);
  assert.equal(isOnboardingComplete(user, { birth_year: 1995, play_style: '', availability: ['Aften'] }), false);
});

test('opret-siden tilbyder "Ved ikke endnu" og har valgfri tidspunkter', () => {
  const constants = readFileSync(path.join(path.dirname(profileUtilsPath), 'platformConstants.js'), 'utf8');
  assert.match(constants, /PLAY_STYLES = \[[^\]]*'Ved ikke endnu'/);
  const onboarding = readFileSync(path.join(path.dirname(profileUtilsPath), '../pages/OnboardingPage.jsx'), 'utf8');
  assert.match(onboarding, /Tilgængelighed er valgfri/);
});

test('canAccessDashboard keeps phone-exempt substantial-profile path', () => {
  const src = readFileSync(profileUtilsPath, 'utf8');
  assert.match(src, /hasSubstantialProfileProgress\(profile\)/);
});
