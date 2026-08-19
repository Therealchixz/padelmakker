import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_MISSING_FIELD_IDS,
  resolveOnboardingFieldIdFromMissing,
  resolveOnboardingFieldIdFromErrorMessage,
  fieldValidationMessage,
} from '../../src/lib/formValidationScroll.js';

test('resolveOnboardingFieldIdFromMissing maps first missing label', () => {
  assert.equal(resolveOnboardingFieldIdFromMissing(['gyldig email', 'fødselsdato']), 'onb-email');
  assert.equal(resolveOnboardingFieldIdFromMissing([]), null);
  assert.equal(resolveOnboardingFieldIdFromMissing(null), null);
});

test('resolveOnboardingFieldIdFromErrorMessage maps finish errors', () => {
  assert.equal(
    resolveOnboardingFieldIdFromErrorMessage('Du skal acceptere handelsbetingelser og privatlivspolitik'),
    'onb-terms',
  );
  assert.equal(resolveOnboardingFieldIdFromErrorMessage('Bekræft venligst, at du ikke er en robot.'), 'onb-captcha');
  assert.equal(
    resolveOnboardingFieldIdFromErrorMessage('Indtast et gyldigt telefonnummer (fx 20112233).'),
    'onb-phone',
  );
});

test('fieldValidationMessage returns message only for matching field', () => {
  assert.equal(fieldValidationMessage({ field: 'name', message: 'Angiv et navn.' }, 'name'), 'Angiv et navn.');
  assert.equal(fieldValidationMessage({ field: 'name', message: 'Angiv et navn.' }, 'start_date'), null);
  assert.equal(fieldValidationMessage(null, 'name'), null);
});

test('ONBOARDING_MISSING_FIELD_IDS covers step requirements', () => {
  assert.equal(ONBOARDING_MISSING_FIELD_IDS.niveau, 'onb-level-section');
  assert.equal(ONBOARDING_MISSING_FIELD_IDS.region, 'onb-region');
  assert.equal(ONBOARDING_MISSING_FIELD_IDS.by, 'onb-city');
  assert.equal(ONBOARDING_MISSING_FIELD_IDS['accept af vilkår og privatlivspolitik'], 'onb-terms');
});