import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthErrorMessage, mapPhoneAuthErrorMessage, authErrorSuggestsLogin } from '../../src/lib/authErrorMessages.js';

describe('mapAuthErrorMessage', () => {
  it('maps invalid login credentials', () => {
    assert.equal(
      mapAuthErrorMessage('Invalid login credentials'),
      'Forkert e-mail/telefonnummer eller adgangskode.',
    );
  });

  it('maps email not confirmed', () => {
    assert.equal(
      mapAuthErrorMessage('Email not confirmed'),
      'Bekræft din email før du logger ind — tjek din indbakke.',
    );
  });

  it('maps email already registered', () => {
    assert.equal(
      mapAuthErrorMessage('A user with this email address has already been registered'),
      'Den e-mail er allerede i brug på en anden konto.',
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
      'Koden passer ikke eller er udløbet. Tjek de 6 cifre — eller send en ny kode.',
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

  it('signup context: existing account suggests logging in', () => {
    const msg = mapAuthErrorMessage('User already registered', 'signup');
    assert.match(msg, /Log ind i stedet/);
    assert.equal(authErrorSuggestsLogin('User already registered'), true);
    assert.equal(authErrorSuggestsLogin('Invalid login credentials'), false);
  });

  it('signup context: unknown snake_case error is not called a login error', () => {
    assert.doesNotMatch(mapAuthErrorMessage('unexpected_failure', 'signup'), /Login/);
    assert.doesNotMatch(mapPhoneAuthErrorMessage('unexpected_failure'), /Login/);
  });

  it('reset context: expired link and same password', () => {
    assert.match(mapAuthErrorMessage('Auth session missing!', 'reset'), /Linket er udløbet/);
    assert.match(mapAuthErrorMessage('New password should be different from the old password.', 'reset'), /forskellig/);
  });
});
