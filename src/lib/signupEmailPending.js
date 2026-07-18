/**
 * Persistér e-mail-trin efter SMS-signup, så refresh ikke mister konteksten.
 */

const SIGNUP_EMAIL_PENDING_KEY = 'pm_signup_email_pending';

/**
 * @returns {{ email: string, phone?: string } | null}
 */
export function readPendingSignupEmail() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SIGNUP_EMAIL_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const email = String(parsed?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return null;
    const phone = String(parsed?.phone || '').trim();
    return phone ? { email, phone } : { email };
  } catch {
    return null;
  }
}

/**
 * @param {{ email: string, phone?: string }} pending
 */
export function writePendingSignupEmail(pending) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const email = String(pending?.email || '').trim().toLowerCase();
    if (!email) return;
    const phone = String(pending?.phone || '').trim();
    sessionStorage.setItem(
      SIGNUP_EMAIL_PENDING_KEY,
      JSON.stringify(phone ? { email, phone } : { email }),
    );
  } catch {
    /* ignore */
  }
}

export function clearPendingSignupEmail() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SIGNUP_EMAIL_PENDING_KEY);
  } catch {
    /* ignore */
  }
}
