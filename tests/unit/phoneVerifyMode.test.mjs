/**
 * SMS-kode afvist for Google-brugere (bruger-mail 3. nov. 2026): koden var rigtig,
 * men blev tjekket som ny telefon-konto i stedet for telefonskift.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePhoneVerifyMode } from '../../src/lib/phoneVerifyMode.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(root, 'src/pages/PhoneVerificationPage.jsx'), 'utf8');

test('Google-bruger der lige har sendt kode fra onboarding → telefonskift', () => {
  const googleUser = {
    email: 'spiller@gmail.com',
    phone_confirmed_at: null,
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { signup_phone: '+4520112233', phone_verification_required: true, onboarding_completed: true },
  };
  assert.equal(resolvePhoneVerifyMode(googleUser), 'phone_change');
});

test('ny konto med telefon + adgangskode → signup', () => {
  assert.equal(resolvePhoneVerifyMode(null), 'signup'); // ingen session endnu
  assert.equal(resolvePhoneVerifyMode({ phone_confirmed_at: null, user_metadata: { pending_email: 'a@b.dk' } }), 'signup');
  assert.equal(resolvePhoneVerifyMode({ phone_confirmed_at: null, user_metadata: { phone_first_signup: true } }), 'signup');
});

test('telefon allerede bekræftet → ikke telefonskift', () => {
  assert.equal(resolvePhoneVerifyMode({ phone_confirmed_at: '2026-11-03T12:00:00Z', user_metadata: {} }), 'signup');
});

test('siden vælger telefonskift før den bruger nummeret fra onboarding', () => {
  const effect = page.slice(page.indexOf('useEffect(() => {\n    const metaPhone'));
  assert.ok(effect.indexOf('shouldUseLegacyPhoneChangeFlow(user)') < effect.indexOf('if (phoneFromState) {'));
});

test('auto-tjek ved 6. ciffer bruger den indtastede kode, ikke den gamle', () => {
  assert.match(page, /onComplete=\{\(code\) => \{ void verifyCode\(code\) \}\}/);
  assert.match(page, /cleanOtp\(typeof codeArg === 'string' \? codeArg : otpCode\)/);
  assert.match(page, /if \(verifyingRef\.current\) return/);
});
