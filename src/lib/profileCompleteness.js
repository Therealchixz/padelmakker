import { isValidCityPlace } from './dawaPlaceSearch.js';

const PREFILL_PHONE_KEY = 'pm_login_prefill_phone';

export function hasEnteredEmail(user, pendingEmail = '') {
  if (String(user?.email || '').trim()) return true;
  return Boolean(String(pendingEmail || '').trim());
}

export function getLoginCompletenessGaps(user, profile, options = {}) {
  const phoneExempt = options.phoneExempt === true;
  return {
    email: !hasEnteredEmail(user, options.pendingEmail),
    phone: !phoneExempt && !user?.phone_confirmed_at,
    city: !isValidCityPlace(profile),
  };
}

/** Side til at indtaste manglende mail/by. Telefon styres af SMS-gate, medmindre admin har slået den fra. */
export function needsLoginCompletenessPage(user, profile, options = {}) {
  if (!user || !profile) return false;
  const gaps = getLoginCompletenessGaps(user, profile, options);
  return gaps.email || gaps.city;
}

export function writePrefillPhone(phone) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const value = String(phone || '').trim();
    if (!value) {
      sessionStorage.removeItem(PREFILL_PHONE_KEY);
      return;
    }
    sessionStorage.setItem(PREFILL_PHONE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function readPrefillPhone() {
  try {
    if (typeof sessionStorage === 'undefined') return '';
    return String(sessionStorage.getItem(PREFILL_PHONE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function clearPrefillPhone() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(PREFILL_PHONE_KEY);
  } catch {
    /* ignore */
  }
}
