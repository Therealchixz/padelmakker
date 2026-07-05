import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

test('onboarding requires users to confirm their email address before continuing', async () => {
  const onboardingPage = await readFile(new URL('../../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');

  assert.match(onboardingPage, /email_confirm/);
  assert.match(onboardingPage, /Bekr[aæ]ft e-mail/);
  assert.match(onboardingPage, /Emails matcher ikke|E-mailadresserne matcher ikke/);
  assert.match(onboardingPage, /email skrevet ens i begge felter/);
});

test('onboarding explains the signup choices without adding an early profile preview', async () => {
  const onboardingPage = await readFile(new URL('../../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');

  assert.match(onboardingPage, /LEVEL_CARDS/);
  assert.match(onboardingPage, /vises ikke offentligt/i);
  assert.match(onboardingPage, /Finjustér niveau/);
  assert.match(onboardingPage, /Mangler før du kan fortsætte/);
  assert.match(onboardingPage, /stepTitles = \["Opret profil", "Dit niveau", "Dit område", "Din profil"\]/);
  assert.doesNotMatch(onboardingPage, /Forh[aå]ndsvisning af profil[\s\S]*step === 0/);
});

test('signup confirmation page gives clear next steps and troubleshooting', async () => {
  const confirmationPage = await readFile(new URL('../../src/pages/SignupEmailSentPage.jsx', import.meta.url), 'utf8');

  assert.match(confirmationPage, /samme browser/i);
  assert.match(confirmationPage, /24 timer/i);
  assert.match(confirmationPage, /spam/i);
  assert.match(confirmationPage, /kan du logge ind/i);
});

test('onboarding returns to the top whenever the user changes step', async () => {
  const onboardingPage = await readFile(new URL('../../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');

  assert.match(onboardingPage, /useRef/);
  assert.match(onboardingPage, /onboardingTopRef/);
  assert.match(onboardingPage, /scrollIntoView\(\{/);
  assert.match(onboardingPage, /block: "start"/);
  assert.match(onboardingPage, /ref=\{onboardingTopRef\}/);
});
