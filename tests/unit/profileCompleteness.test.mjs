import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  getLoginCompletenessGaps,
  needsLoginCompletenessPage,
  hasEnteredEmail,
} from '../../src/lib/profileCompleteness.js';
import { shouldRequireEmailVerification } from '../../src/lib/phoneVerification.js';

const aarhus = { city: 'Aarhus', latitude: 56.15, longitude: 10.21 };

test('hasEnteredEmail kræver auth-email eller pending', () => {
  assert.equal(hasEnteredEmail({ email: '' }), false);
  assert.equal(hasEnteredEmail({ email: 'a@b.dk' }), true);
  assert.equal(hasEnteredEmail({ email: '' }, 'a@b.dk'), true);
});

test('getLoginCompletenessGaps kræver mail, telefon og by', () => {
  const user = { email: '', phone_confirmed_at: null };
  const gaps = getLoginCompletenessGaps(user, { city: '' }, { phoneExempt: false });
  assert.deepEqual(gaps, { email: true, phone: true, city: true });

  const almost = getLoginCompletenessGaps(
    { email: 'a@b.dk', phone_confirmed_at: '2026-01-01' },
    aarhus,
    { phoneExempt: false },
  );
  assert.deepEqual(almost, { email: false, phone: false, city: false });
});

test('admin phone-exempt springer telefon over', () => {
  const gaps = getLoginCompletenessGaps(
    { email: 'a@b.dk', phone_confirmed_at: null },
    aarhus,
    { phoneExempt: true },
  );
  assert.equal(gaps.phone, false);
  assert.equal(needsLoginCompletenessPage({ email: 'a@b.dk' }, aarhus, { phoneExempt: true }), false);
});

test('completeness-side vises ved manglende mail eller by — ikke kun telefon', () => {
  const user = { email: 'a@b.dk', phone_confirmed_at: null };
  assert.equal(needsLoginCompletenessPage(user, { city: '' }, { phoneExempt: false }), true);
  assert.equal(needsLoginCompletenessPage(user, aarhus, { phoneExempt: false }), false);
  assert.equal(
    needsLoginCompletenessPage({ email: '' }, aarhus, { phoneExempt: true, pendingEmail: '' }),
    true,
  );
  assert.equal(
    needsLoginCompletenessPage({ email: '' }, aarhus, { phoneExempt: true, pendingEmail: 'a@b.dk' }),
    false,
  );
});

test('pending email tæller som indtastet og skal bekræftes', () => {
  const user = { email: '', email_confirmed_at: null };
  assert.equal(shouldRequireEmailVerification(user), false);
  assert.equal(shouldRequireEmailVerification(user, { pendingEmail: 'a@b.dk' }), true);
  assert.equal(
    shouldRequireEmailVerification({ email: 'a@b.dk', email_confirmed_at: '2026-01-01' }, { pendingEmail: 'x@y.dk' }),
    false,
  );
});

test('login-gate sender manglende felter til /profil/fuldfoer før dashboard', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const platform = readFileSync(join(dir, '../../src/padelmakker-platform.jsx'), 'utf8');
  assert.match(platform, /needsLoginCompletenessPage/);
  assert.match(platform, /\/profil\/fuldfoer/);
  assert.match(platform, /requiresProfileCompleteness/);
  const page = readFileSync(join(dir, '../../src/pages/CompleteProfilePage.jsx'), 'utf8');
  assert.match(page, /Færdiggør din profil/);
  assert.match(page, /CityPlaceSearchField/);
  assert.doesNotMatch(page, /onClose=\{\(\) => \{\}\}/);
});
