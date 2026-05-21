/**
 * Danske fejltekster til Supabase Auth (login, nulstilling af adgangskode).
 */

export function mapAuthErrorMessage(message, context = 'login') {
  const m = String(message || '').toLowerCase();

  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Forkert email eller adgangskode.';
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
      : 'Forkert email eller adgangskode.';
  }
  if (m.includes('password') && m.includes('least')) {
    return 'Adgangskoden opfylder ikke kravene.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Kunne ikke forbinde. Tjek dit netværk og prøv igen.';
  }
  if (m.includes('captcha') || m.includes('turnstile')) {
    return 'Bekræft venligst, at du ikke er en robot.';
  }

  const raw = String(message || '').trim();
  if (!raw || /^[a-z_]+$/i.test(raw) && raw.includes('_')) {
    return context === 'forgot'
      ? 'Kunne ikke sende nulstillingsmail. Prøv igen.'
      : 'Login fejlede. Tjek email og adgangskode.';
  }
  return raw;
}

/** SMS / OTP under oprettelse og telefonbekræftelse */
export function mapPhoneAuthErrorMessage(message) {
  const m = String(message || '').toLowerCase();

  if ((m.includes('expired') || m.includes('expire')) && (m.includes('otp') || m.includes('token') || m.includes('sms'))) {
    return 'Koden er udløbet. Send en ny SMS-kode og prøv igen.';
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

  return mapAuthErrorMessage(message, 'login');
}
