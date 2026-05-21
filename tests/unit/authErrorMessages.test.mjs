import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthErrorMessage } from '../../src/lib/authErrorMessages.js';

describe('mapAuthErrorMessage', () => {
  it('maps invalid login credentials', () => {
    assert.equal(
      mapAuthErrorMessage('Invalid login credentials'),
      'Forkert email eller adgangskode.',
    );
  });

  it('maps email not confirmed', () => {
    assert.equal(
      mapAuthErrorMessage('Email not confirmed'),
      'Bekræft din email før du logger ind — tjek din indbakke.',
    );
  });

  it('uses forgot context fallback', () => {
    assert.equal(
      mapAuthErrorMessage('something_went_wrong', 'forgot'),
      'Kunne ikke sende nulstillingsmail. Prøv igen.',
    );
  });
});
