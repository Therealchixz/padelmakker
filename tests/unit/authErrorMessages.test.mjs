import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthErrorMessage, mapPhoneAuthErrorMessage } from '../../src/lib/authErrorMessages.js';

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

  it('maps expired OTP for phone', () => {
    assert.equal(
      mapPhoneAuthErrorMessage('Token has expired or is invalid'),
      'Koden er udløbet. Send en ny SMS-kode og prøv igen.',
    );
  });

  it('maps Twilio invalid To (21211)', () => {
    assert.equal(
      mapPhoneAuthErrorMessage('Twilio fejl: error code 21211'),
      'Telefonnummeret ser ugyldigt ud. Brug landekode, fx +45 12 34 56 78.',
    );
  });

  it('maps Twilio trial unverified To (21608)', () => {
    assert.match(
      mapPhoneAuthErrorMessage(
        "The 'to' phone number provided is not yet verified for this account.",
      ),
      /testkonto/,
    );
  });
});
