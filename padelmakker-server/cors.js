const DEFAULT_ALLOWED_ORIGINS = [
  'https://padelmakker.dk',
  'https://www.padelmakker.dk',
];

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readAllowedOrigins() {
  const raw = globalThis?.process?.env?.CORS_ALLOWED_ORIGINS || '';
  const fromEnv = raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

export function setCorsHeaders(req, res) {
  const requestOrigin = normalizeOrigin(req.headers.origin);
  const allowedOrigins = readAllowedOrigins();
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
}
