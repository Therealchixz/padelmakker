/**
 * Stram CORS for /api/* JSON-endpoints (ikke `*`).
 * Sætter kun Access-Control-Allow-Origin når Origin matcher allowlisten.
 */

const DEFAULT_ORIGINS = [
  'https://www.padelmakker.dk',
  'https://padelmakker.dk',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function buildAllowlist() {
  const env = globalThis.process?.env || {};
  const extra = String(env.API_CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const vercelHost = env.VERCEL_URL?.trim();
  const vercelOrigin = vercelHost ? `https://${vercelHost}` : null;
  const base = [...DEFAULT_ORIGINS, ...(vercelOrigin ? [vercelOrigin] : []), ...extra];
  return [...new Set(base)];
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export function setJsonCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || typeof origin !== 'string') return;
  const allow = buildAllowlist();
  if (!allow.includes(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
}
