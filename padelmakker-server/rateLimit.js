/**
 * Distribueret rate limiter via Supabase (check_rate_limit RPC).
 * Virker på tværs af alle Vercel-container-instanser.
 * Falder tilbage til at tillade requesten hvis Supabase er utilgængeligt.
 */

/* global process */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Returnerer true hvis forespørgslen er tilladt, false hvis den er rate-limited.
 * @param {string} key        Unik nøgle — typisk IP-adresse
 * @param {number} maxReqs    Max antal forespørgsler per vindue (default: 30)
 * @param {number} windowMs   Tidsvindue i millisekunder (default: 60 sekunder)
 */
export async function checkRateLimit(key, maxReqs = 30, windowMs = 60_000) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return true; // fail open: ingen konfiguration
  }

  const windowStart = Math.floor(Date.now() / windowMs);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_key: key, p_window_start: windowStart, p_max: maxReqs }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return true; // fail open ved DB-fejl
    const allowed = await res.json();
    return allowed === true;
  } catch {
    return true; // fail open ved timeout eller netværksfejl
  }
}

/**
 * Hent klientens IP fra Vercel-headers eller socket.
 *
 * Foretrækker headers som Vercel's edge sætter selv (kan ikke spoofes af klienten)
 * fremfor x-forwarded-for, hvor klienten kan sende egen værdi der ender forrest
 * i kæden i nogle deployment-konfigurationer.
 *
 * @param {import('http').IncomingMessage} req
 */
export function getClientIp(req) {
  // x-vercel-forwarded-for er Vercel-edge-set og kan ikke spoofes
  const vercelForwarded = req.headers['x-vercel-forwarded-for'];
  if (vercelForwarded) {
    const first = String(vercelForwarded).split(',')[0].trim();
    if (first) return first;
  }

  // x-real-ip er typisk sat af Vercel på direkte requests
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    const trimmed = String(realIp).trim();
    if (trimmed) return trimmed;
  }

  // Fallback: x-forwarded-for (mindre pålidelig, kan indeholde klient-værdier)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }

  return req.socket?.remoteAddress || 'unknown';
}
