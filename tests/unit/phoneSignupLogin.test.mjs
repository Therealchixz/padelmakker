/**
 * Telefon-konti uden bekræftet mail kunne ikke logge ind igen (gennemgang 3. nov. 2026):
 * mailen kommer først på kontoen, når linket i mailen er klikket, og login tog kun mail.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginCredentialsFromIdentifier, pendingAccountEmail } from '../../src/lib/loginIdentifier.js';
import { shouldRequireEmailVerification, emailAwaitingConfirmation } from '../../src/lib/phoneVerification.js';
import { hasEnteredEmail } from '../../src/lib/profileCompleteness.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('login-feltet tager både mail og telefonnummer', () => {
  assert.deepEqual(loginCredentialsFromIdentifier(' spiller@mail.dk ', 'x'), { email: 'spiller@mail.dk', password: 'x' });
  assert.deepEqual(loginCredentialsFromIdentifier('20112233', 'x'), { phone: '+4520112233', password: 'x' });
  assert.deepEqual(loginCredentialsFromIdentifier('+45 20 11 22 33', 'x'), { phone: '+4520112233', password: 'x' });
  assert.equal(loginCredentialsFromIdentifier('', 'x'), null);
  // For kort til et nummer → behandles som mail, så Supabase giver den normale fejl.
  assert.deepEqual(loginCredentialsFromIdentifier('1234', 'x'), { email: '1234', password: 'x' });
});

test('telefon-konto med bekræftet SMS og mail der venter → kommer ind i appen (mail bekræftes senere)', () => {
  const phoneUser = { phone: '4520112233', phone_confirmed_at: '2026-11-01T10:00:00Z', email: '', new_email: 'spiller@mail.dk', email_confirmed_at: null };
  assert.equal(pendingAccountEmail(phoneUser), 'spiller@mail.dk');
  // Ejerens beslutning 4. nov. 2026: ingen tvungen log ud / e-mail-trin efter SMS.
  assert.equal(shouldRequireEmailVerification(phoneUser), false);
  assert.equal(emailAwaitingConfirmation(phoneUser), 'spiller@mail.dk', 'påmindelsen viser mailen');
  assert.equal(hasEnteredEmail(phoneUser), true, 'ikke bedt om at skrive mailen igen');
});

test('konto uden bekræftet telefon og uden bekræftet mail → skal stadig bekræfte mailen', () => {
  assert.equal(shouldRequireEmailVerification({ email: 'a@b.dk', email_confirmed_at: null, phone_confirmed_at: null }), true);
  assert.equal(emailAwaitingConfirmation({ email: 'a@b.dk', email_confirmed_at: '2026-01-01' }), '');
});

test('bekræftet mail og Google-brugere er uændrede', () => {
  assert.equal(shouldRequireEmailVerification({ email: 'a@b.dk', email_confirmed_at: '2026-01-01' }), false);
  assert.equal(shouldRequireEmailVerification({ email: '', new_email: '', email_confirmed_at: null }), false);
});

test('appen bruger det nye login og den ventende mail', () => {
  assert.match(readFileSync(join(root, 'src/lib/AuthContext.jsx'), 'utf8'), /loginCredentialsFromIdentifier\(email, password\)/);
  assert.match(readFileSync(join(root, 'src/pages/SignupEmailSentPage.jsx'), 'utf8'), /pendingAccountEmail\(user\)/);
  assert.match(readFileSync(join(root, 'src/pages/LoginPage.jsx'), 'utf8'), /E-mail eller telefonnummer/);
});

test('e-mail-påmindelsen får login-kontoen (authUser), ikke spillerprofilen', async () => {
  const { readFile } = await import('node:fs/promises');
  // Profilen har ingen email_confirmed_at/new_email, så påmindelsen ville aldrig (eller altid) vises.
  // Påmindelsen står lige under den fælles toplinje på Hjem og Min profil.
  for (const f of ['HomeTab', 'ProfilTab']) {
    const s = await readFile(new URL(`../../src/dashboard/${f}.jsx`, import.meta.url), 'utf8');
    assert.match(s, /<EmailConfirmReminder user=\{authUser\} \/>/, f);
  }
});
