/**
 * Engangsmail til dem, der sad fast i oprettelsen (ejeren 3. nov. 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignupRescueEmail, rescueGroupFor } from '../../supabase/functions/send-signup-rescue/content.ts';

const done = { id: 'p', full_name: 'Anna Hansen', birth_year: 1990, play_style: 'Ved ikke endnu', city: 'Aarhus', latitude: 56.1 };
const google = { id: 'u', email: 'a@gmail.com', email_confirmed_at: 'x', phone_confirmed_at: null, app_metadata: { providers: ['google'] } };
const phone = { id: 'u', email: '', new_email: 'b@mail.dk', email_confirmed_at: null, phone_confirmed_at: 'x', app_metadata: { providers: ['phone'] } };

test('hver gruppe får sin egen besked', () => {
  assert.equal(rescueGroupFor(google, done), 'google_sms');
  assert.equal(rescueGroupFor(phone, done), 'phone_email');
  assert.equal(rescueGroupFor({ ...google, app_metadata: { providers: ['email'] } }, done), 'email_sms');
  assert.equal(rescueGroupFor({ ...google, phone_confirmed_at: 'x' }, { ...done, birth_year: null }), 'profile');
  assert.equal(rescueGroupFor({ ...google, phone_confirmed_at: 'x' }, { ...done, city: null }), 'city');
});

test('færdige, afmeldte, admins, bannede og konti uden profil eller mail får intet', () => {
  assert.equal(rescueGroupFor({ ...google, phone_confirmed_at: 'x' }, done), null);
  assert.equal(rescueGroupFor(google, { ...done, notification_prefs: { email: { opdagelse: 'false' } } }), null);
  assert.equal(rescueGroupFor(google, { ...done, role: 'admin' }), null);
  assert.equal(rescueGroupFor(google, { ...done, is_banned: true }), null);
  assert.equal(rescueGroupFor(google, null), null);
  assert.equal(rescueGroupFor({ ...phone, new_email: '' }, done), null);
  assert.equal(rescueGroupFor({ ...google, email: 'qa@example.invalid' }, done), null);
});

test('mailen har navn, trin, login-link og afmeld-link', () => {
  const e = buildSignupRescueEmail('phone_email', phone, done, { siteUrl: 'https://www.padelmakker.dk', unsubLink: 'https://x/afmeld?t=1', cvr: '46403193', todayLabel: 'Tirsdag' });
  assert.equal(e.subject, 'Anna, din profil på PadelMakker er næsten klar');
  assert.match(e.text, /Skriv dit telefonnummer og din adgangskode/);
  assert.match(e.html, /\/login\?kilde=signup_rescue/);
  assert.match(e.html, /afmeld\?t=1/);
  assert.match(e.text, /Afmeld mails med ét klik/);
});
