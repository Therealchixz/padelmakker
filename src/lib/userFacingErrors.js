/**
 * Map tekniske Supabase/fetch-fejl til korte danske toast-tekster.
 */

import { mapAuthErrorMessage } from './authErrorMessages.js';

const TECHNICAL_RE =
  /^(PGRST|JWT|JSON|TypeError|NetworkError|AbortError)|postgres|violates|permission denied|row-level|rls|rpc|supabase|stack|at Object\.|unexpected token/i;

/**
 * @param {unknown} error
 * @param {string} [fallback]
 */
export function mapUserFacingError(error, fallback = 'Noget gik galt. Prøv igen.') {
  const raw = String(
    (error && typeof error === 'object' && 'message' in error && error.message) || error || '',
  ).trim();
  if (!raw) return fallback;

  const authMapped = mapAuthErrorMessage(raw, 'login');
  // mapAuthErrorMessage returns raw when unknown — only trust when it changed the text
  if (authMapped && authMapped !== raw) return authMapped;

  const m = raw.toLowerCase();

  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) {
    return 'Kunne ikke forbinde. Tjek dit netværk og prøv igen.';
  }
  if (m.includes('jwt') || m.includes('not authenticated') || m.includes('session')) {
    return 'Din session er udløbet. Log ind igen.';
  }
  if (m.includes('permission') || m.includes('not authorized') || m.includes('row-level') || m.includes('rls')) {
    return 'Du har ikke adgang til den handling.';
  }
  if (m.includes('unique') || m.includes('duplicate') || m.includes('already exists')) {
    return 'Det findes allerede. Opdater siden og prøv igen.';
  }
  if (m.includes('foreign key') || m.includes('violates')) {
    return 'Handlingen kunne ikke gennemføres. Prøv igen.';
  }
  if (m.includes('timeout') || m.includes('timed out')) {
    return 'Det tog for lang tid. Prøv igen.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'For mange forsøg. Vent et øjeblik og prøv igen.';
  }

  // Allerede kort, dansk-agtig besked (fx vores egne throw new Error('…'))
  if (raw.length <= 120 && !TECHNICAL_RE.test(raw) && /[æøåÆØÅ]/.test(raw)) {
    return raw;
  }
  if (raw.length <= 90 && !TECHNICAL_RE.test(raw) && !/[A-Z_]{3,}/.test(raw)) {
    // Korte engelske produktfejl vi selv kaster — behold hvis læsbare
    if (!m.includes('column') && !m.includes('relation') && !m.includes('syntax')) {
      return raw;
    }
  }

  return fallback;
}
