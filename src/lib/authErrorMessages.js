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
