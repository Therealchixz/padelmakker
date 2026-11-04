/**
 * Danske fejltekster til Supabase Auth.
 * context: 'login' | 'signup' | 'forgot' | 'reset'
 */

import { mapTwilioSmsErrorMessage } from './twilioSmsErrors.js';

export function mapAuthErrorMessage(message, context = 'login') {
  const m = String(message || '').toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Forkert e-mail/telefonnummer eller adgangskode.';
  }
  if (m.includes('email not confirmed')) {
    return 'Bekræft din email før du logger ind — tjek din indbakke.';
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'For mange forsøg. Vent et øjeblik og prøv igen.';
  }
  if (m.includes('user not found')) {
    return context === 'forgot'
      ? 'Hvis email findes, sender vi et link. Tjek din indbakke.'
      : 'Forkert e-mail/telefonnummer eller adgangskode.';
  }
  if (m.includes('password') && m.includes('least')) {
    return 'Adgangskoden er for kort eller for svag. Brug mindst 8 tegn.';
  }
  if (m.includes('should be different') || m.includes('same password') || m.includes('same_password')) {
    return 'Den nye adgangskode skal være forskellig fra den gamle.';
  }
  if (context === 'reset' && (m.includes('session') || m.includes('expired') || m.includes('jwt'))) {
    return 'Linket er udløbet. Bed om et nyt link under "Glemt adgangskode" på login-siden.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Kunne ikke forbinde. Tjek dit netværk og prøv igen.';
  }
  if (m.includes('captcha') || m.includes('turnstile')) {
    return 'Bekræft venligst, at du ikke er en robot.';
  }
  if (
    (m.includes('already') && (m.includes('registered') || m.includes('exists') || m.includes('in use')))
    || m.includes('email_exists')
    || m.includes('user already registered')
  ) {
    if (context === 'signup') {
      return 'Der findes allerede en profil med det telefonnummer eller den e-mail. Log ind i stedet, eller brug "Glemt adgangskode".';
    }
    return 'Den e-mail er allerede i brug på en anden konto.';
  }

  const raw = String(message || '').trim();
  if (!raw || /^[a-z_]+$/i.test(raw) && raw.includes('_')) {
    if (context === 'forgot') return 'Kunne ikke sende nulstillingsmail. Prøv igen.';
    if (context === 'signup') return 'Oprettelsen fejlede. Prøv igen om lidt — eller skriv til kontakt@padelmakker.dk.';
    if (context === 'reset') return 'Kunne ikke gemme den nye adgangskode. Prøv igen, eller bed om et nyt link.';
    return 'Login fejlede. Tjek email og adgangskode.';
  }
  return raw;
}

/** Skal fejlen vise en "Log ind i stedet"-genvej? (kontoen findes allerede) */
export function authErrorSuggestsLogin(message) {
  const m = String(message || '').toLowerCase();
  return (
    (m.includes('already') && (m.includes('registered') || m.includes('exists') || m.includes('in use')))
    || m.includes('email_exists')
    || m.includes('phone_exists')
    || m.includes('allerede')
  );
}

/** SMS / OTP under oprettelse og telefonbekræftelse */
export function mapPhoneAuthErrorMessage(message, context = 'signup') {
  const twilioMapped = mapTwilioSmsErrorMessage(message);
  if (twilioMapped) return twilioMapped;

  const m = String(message || '').toLowerCase();

  // Supabase bruger samme besked ("Token has expired or is invalid") for en forkert og en udløbet kode.
  if ((m.includes('expired') || m.includes('expire')) && (m.includes('otp') || m.includes('token') || m.includes('sms'))) {
    return 'Koden passer ikke eller er udløbet. Tjek de 6 cifre — eller send en ny kode.';
  }
  if (m.includes('invalid') && (m.includes('otp') || m.includes('token') || m.includes('code'))) {
    return 'Forkert kode. Tjek de 6 cifre fra SMS’en og prøv igen.';
  }
  if (m.includes('phone') && m.includes('already')) {
    return 'Telefonnummeret er allerede knyttet til en konto.';
  }
  if (m.includes('sms') && (m.includes('send') || m.includes('deliver'))) {
    return 'Kunne ikke sende SMS lige nu. Prøv igen om et øjeblik.';
  }
  if (m.includes('signups') && m.includes('disabled')) {
    return 'SMS-oprettelse er midlertidigt lukket. Prøv igen senere.';
  }

  return mapAuthErrorMessage(message, context);
}
