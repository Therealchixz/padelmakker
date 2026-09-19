/**
 * Tjek om en adgangskode optræder i kendte datalæk (Have I Been Pwned).
 *
 * Erstatter Supabases "leaked password protection", som kræver Pro.
 *
 * Privatliv — k-anonymitet: kun de FØRSTE FEM tegn af kodeordets SHA-1-sum
 * sendes afsted. Tjenesten svarer med alle kendte suffikser der deler det
 * præfiks (typisk 500-1000 stykker), og sammenligningen sker her på enheden.
 * Hverken kodeordet eller den fulde sum forlader browseren, og tjenesten kan
 * ikke udlede hvilket kodeord der blev tjekket.
 *
 * Fejler ÅBENT: kan tjenesten ikke nås, eller svarer den uventet, blokerer vi
 * ikke oprettelsen. En utilgængelig tredjepart må ikke kunne spærre for at nye
 * brugere kan melde sig til.
 *
 * Kræver https://api.pwnedpasswords.com i CSP connect-src (vercel.json).
 */

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const DEFAULT_TIMEOUT_MS = 3500;

/** SHA-1 som store hex-bogstaver. Web Crypto findes i browseren og i Node 18+. */
export async function sha1Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto utilgængelig');
  const bytes = new TextEncoder().encode(String(text ?? ''));
  const digest = await subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Find antal forekomster af ét suffiks i svaret fra range-endpointet.
 *
 * Svaret er linjer på formen `SUFFIKS:ANTAL`, fx `003D68EB55068C33ACE09247EE4C639306B:3`.
 * Ren funktion, så logikken kan testes uden netværk.
 *
 * @returns {number} antal læk, 0 hvis suffikset ikke findes
 */
export function countBreachesInRangeBody(body, suffix) {
  const wanted = String(suffix || '').trim().toUpperCase();
  if (!wanted) return 0;
  for (const line of String(body || '').split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    if (line.slice(0, sep).trim().toUpperCase() !== wanted) continue;
    const n = Number.parseInt(line.slice(sep + 1).trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

/**
 * @param {string} password
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<{ breached: boolean, count: number, checked: boolean }>}
 *   `checked: false` betyder at tjekket ikke kunne gennemføres — behandl som OK.
 */
export async function checkPasswordBreached(password, opts = {}) {
  const pw = String(password ?? '');
  if (!pw) return { breached: false, count: 0, checked: false };

  const doFetch = opts.fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') return { breached: false, count: 0, checked: false };

  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const hash = await sha1Hex(pw);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await doFetch(`${RANGE_URL}${prefix}`, {
      method: 'GET',
      // Add-Padding gør svarene ens store, så svarets længde ikke røber noget.
      headers: { 'Add-Padding': 'true' },
      signal: controller ? controller.signal : undefined,
    });
    if (!res?.ok) return { breached: false, count: 0, checked: false };

    const body = await res.text();
    const count = countBreachesInRangeBody(body, suffix);
    return { breached: count > 0, count, checked: true };
  } catch {
    // Netværksfejl, timeout, manglende crypto — fejl åbent.
    return { breached: false, count: 0, checked: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Fælles besked, så signup og nulstilling siger det samme. */
export const BREACHED_PASSWORD_MESSAGE =
  'Den adgangskode er fundet i kendte datalæk. Vælg en anden — gerne en du ikke bruger andre steder.';
