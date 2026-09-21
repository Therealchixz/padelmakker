/**
 * Selve HTTP-kaldet til send-push, skilt ud saa det kan afproeves.
 *
 * Baggrund: kaldet laa tidligere inde i notifications.js som et "fire and forget"
 * med `.catch(() => {})`. To ting fulgte af det:
 *
 *   1. Fejlede kaldet - CORS, netvaerk, 500 - forsvandt fejlen sporloest, og
 *      appen meldte "Test sendt" alligevel.
 *   2. Uden `keepalive` afbryder browseren kaldet, naar siden lukkes eller
 *      suspenderes. Maalt 21. sep. 2026: CORS-preflighten naaede frem kl.
 *      09:23:14, selve kaldet aldrig - skaermen blev laast i mellemtiden.
 *
 * Modulet importerer med vilje hverken Supabase-klienten eller import.meta.env,
 * saa det kan koeres direkte i en test uden browser.
 */

/** @typedef {{ok: boolean, reason: string, detail?: string}} PushResult */

/** @returns {PushResult} */
export function pushResult(ok, reason, detail) {
  return detail ? { ok, reason, detail } : { ok, reason };
}

/**
 * Sender én push via edge-funktionen og fortaeller hvad der skete.
 * Kaster aldrig - udfaldet kommer altid tilbage som et resultat.
 *
 * @returns {Promise<PushResult>}
 */
export async function deliverPush({ fetchImpl, url, accessToken, payload }) {
  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    return pushResult(false, 'network_error', 'fetch er ikke tilgaengelig');
  }

  try {
    const res = await doFetch(url, {
      method: 'POST',
      // Browseren skal faerdiggoere kaldet, selv om siden lukkes undervejs.
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res?.ok) return pushResult(true, 'sent');

    let detaljer = '';
    try {
      detaljer = await res.text();
    } catch {
      /* intet svar at laese - status alene er nok */
    }
    const status = res?.status ?? '?';
    return pushResult(false, 'http_error', `${status}${detaljer ? `: ${detaljer}` : ''}`);
  } catch (e) {
    return pushResult(false, 'network_error', e?.message || String(e));
  }
}
