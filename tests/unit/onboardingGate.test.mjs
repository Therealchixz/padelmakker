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
  assert.match(fnBlock, /birthOk && styleOk && availOk/);
});

test('canAccessDashboard keeps phone-exempt substantial-profile path', () => {
  const src = readFileSync(profileUtilsPath, 'utf8');
  assert.match(src, /hasSubstantialProfileProgress\(profile\)/);
});
