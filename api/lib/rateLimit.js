/**
 * Simpel in-memory rate limiter.
 * Virker indenfor samme serverless-container-instans.
 * Giver beskyttelse mod burst-requests og misbrug.
 */

const store = new Map();

/**
 * Returnerer true hvis forespørgslen er tilladt, false hvis den er rate-limited.
 * @param {string} key        Unik nøgle — typisk IP-adresse
 * @param {number} maxReqs    Max antal forespørgsler per vindue (default: 30)
 * @param {number} windowMs   Tidsvindue i millisekunder (default: 60 sekunder)
 */
export function checkRateLimit(key, maxReqs = 30, windowMs = 60_000) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxReqs) return false;

  entry.count++;
  return true;
}

/**
 * Hent klientens IP fra Vercel-headers eller socket.
 * @param {import('http').IncomingMessage} req
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Ryd gamle poster hvert 5. minut så Map ikke vokser ubegrænset
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 300_000);
