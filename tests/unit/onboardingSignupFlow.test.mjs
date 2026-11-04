import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

test('trin 1 er kort: én e-mail, én adgangskode med vis/skjul, og læk-tjek ved Fortsæt', async () => {
  const onboardingPage = await readFile(new URL('../../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');
  const reminder = await readFile(new URL('../../src/components/EmailConfirmReminder.jsx', import.meta.url), 'utf8');

  // Ejeren 4. nov. 2026: "Kortere trin 1". Gentag-felterne er væk.
  assert.doesNotMatch(onboardingPage, /email_confirm/);
  assert.doesNotMatch(onboardingPage, /password_confirm/);
  assert.match(onboardingPage, /Vis adgangskode/);
  assert.match(onboardingPage, /Skjul adgangskode/);
  // Fejl vises først, når feltet er forladt.
  assert.match(onboardingPage, /onBlur=\{\(\) => touch\("email"\)\}/);
  assert.match(onboardingPage, /touched\.email &&/);
  // Lækket adgangskode fanges på trin 1, ikke først ved oprettelsen.
  assert.match(onboardingPage, /step === 0 && !oauthSession && breachCheckedPasswordRef\.current !== form\.password/);
  assert.match(onboardingPage, /autoComplete="bday-day"/);
  // En tastefejl i e-mailen kan rettes bagefter inde i appen.
  assert.match(reminder, /Forkert e-mail\? Ret den/);
  assert.match(reminder, /supabase\.auth\.updateUser\(\{ email: next \}\)/);
});

test('onboarding explains the signup choices without adding an early profile preview', async () => {
  const onboardingPage = await readFile(new URL('../../src/pages/OnboardingPage.jsx', import.meta.url), 'utf8');

  assert.match(onboardingPage, /LEVEL_CARDS/);
  assert.match(onboardingPage, /vises ikke offentligt/i);
  // Ejeren 24. sep. 2026: man skal selv kunne skrive sit niveau (fx 3.5).
  assert.match(onboardingPage, /Kender du dit niveau\? Skriv det selv/);
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
