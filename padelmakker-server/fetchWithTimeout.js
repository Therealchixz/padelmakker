/**
 * fetch-wrapper med AbortController-timeout.
 *
 * Booking-sites (Halbooking, MATCHi, Bookli) kan blive langsomme eller hænge.
 * Vercel-funktioner betaler for hele ventetiden, så et hængende remote-call kan
 * spise budget og blokere klienten. Timeout giver kontrolleret fejl i stedet.
 */

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * @param {string | URL} input
 * @param {(RequestInit & { timeoutMs?: number }) | undefined} init
 */
export async function fetchWithTimeout(input, init = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  /* Propager evt. ekstern abort til vores controller. */
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}
