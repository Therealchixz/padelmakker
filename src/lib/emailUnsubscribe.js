/**
 * Afmelding af mails fra padelmakker.dk/afmeld. Ren logik, så den kan testes fra node.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUnsubscribeToken(token) {
  return UUID_RE.test(String(token || '').trim());
}

function functionUrl() {
  const base = String(import.meta.env?.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  return `${base}/functions/v1/email-unsubscribe`;
}

/**
 * Send afmeldingen. Returnerer 'done', 'invalid' (ukendt link) eller 'error'.
 * @param {string} token
 * @param {{ fetchImpl?: typeof fetch, url?: string }} [opts]
 */
export async function postEmailUnsubscribe(token, { fetchImpl = fetch, url = functionUrl() } = {}) {
  if (!isValidUnsubscribeToken(token)) return 'invalid';
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: String(token).trim() }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok && data?.ok) return 'done';
    if (res.status === 404 || data?.error === 'unknown_token') return 'invalid';
    return 'error';
  } catch {
    return 'error';
  }
}
