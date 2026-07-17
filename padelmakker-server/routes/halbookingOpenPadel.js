/**
 * GET — auto-POST til Halbooking (padel).
 */

import { collectInputFields, ymdToHalbookingBanedato } from '../halbookingFetch.js';
import { readHalbookingHtml } from '../halbookingEncoding.js';
import { getAllowlistedVenue } from '../halbookingVenuesAllowlist.js';
import { checkRateLimit, getClientIp } from '../rateLimit.js';
import { fetchWithTimeout } from '../fetchWithTimeout.js';

const UA = 'PadelMakkerOpenPadel/1.0 (+https://www.padelmakker.dk)';

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readQuery(req) {
  const raw = req.url || '';
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return new URLSearchParams(q);
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

function sendText(res, status, text, extraHeaders = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

export async function handleHalbookingOpenPadel(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'GET') {
    sendText(res, 405, 'Method not allowed', { Allow: 'GET' });
    return;
  }

  if (!await checkRateLimit(getClientIp(req) + ':booking', 20, 60_000)) {
    sendHtml(res, 429, `<!DOCTYPE html><html><body><p>For mange forespørgsler. Prøv igen om et øjeblik.</p></body></html>`);
    return;
  }

  const qs = readQuery(req);
  const venueId = qs.get('venue') || 'skansen_ntsc';
  const cfg = getAllowlistedVenue(venueId);
  if (!cfg) {
    sendHtml(res, 400, `<!DOCTYPE html><html><body><p>Ukendt venue.</p></body></html>`);
    return;
  }

  const PROC_BANER = cfg.procBaner;
  const OMRAEDE = cfg.omraede;

  try {
    const firstRes = await fetchWithTimeout(PROC_BANER, {
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    });
    if (!firstRes.ok) {
      sendHtml(
        res,
        502,
        `<!DOCTYPE html><html><body><p>Halbooking fejl (${firstRes.status}). <a href="${PROC_BANER}">Prøv direkte</a></p></body></html>`
      );
      return;
    }

    const html0 = await readHalbookingHtml(firstRes);
    const formMatch = html0.match(/<form[^>]*id="multiform"[^>]*>([\s\S]*?)<\/form>/i);
    if (!formMatch) {
      sendHtml(
        res,
        502,
        `<!DOCTYPE html><html><body><p>Kunne ikke læse booking-formular. <a href="${PROC_BANER}">Åbn Halbooking</a></p></body></html>`
      );
      return;
    }

    const params = collectInputFields(formMatch[1]);
    params.set('soeg_omraede', OMRAEDE);
    params.set('mf_para1', '');
    params.set('mf_para2', '');
    params.set('mf_para3', '');
    params.set('mf_para4', '');

    // Valgt dato fra Baner (YYYY-MM-DD) → Halbooking soegdato + banedato (DD-MM-YYYY).
    // Uden dato falder vi tilbage til omr_soeg (= i dag), som tidligere så ud som "en dag for tidligt".
    const banedato = ymdToHalbookingBanedato(qs.get('date'));
    if (banedato) {
      params.set('banedato', banedato);
      params.set('mf_funktion', 'soegdato');
    } else {
      params.set('mf_funktion', 'omr_soeg');
    }

    const pmBane = qs.get('pm_bane');
    const pmTid = qs.get('pm_tid');
    if (pmBane != null && String(pmBane).trim() !== '') {
      const bane = String(pmBane).slice(0, 120);
      if (/^[\p{L}\p{N}\s\-.,()]+$/u.test(bane)) {
        params.set('pm_bane', bane);
      }
    }
    if (pmTid != null && String(pmTid).trim() !== '') {
      const tid = String(pmTid).slice(0, 20);
      if (/^\d{2}:\d{2}$/.test(tid)) {
        params.set('pm_tid', tid);
      }
    }

    let hidden = '';
    for (const [name, value] of params.entries()) {
      hidden += `<input type="hidden" name="${escAttr(name)}" value="${escAttr(value)}"/>`;
    }

    const procEsc = escAttr(PROC_BANER);
    const body = `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Viderestiller til booking…</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:1.5rem;max-width:32rem;">
  <p>Åbner Halbooking…</p>
  <form id="pm-hb-padel" method="post" action="${procEsc}" accept-charset="iso-8859-1">
    ${hidden}
    <p style="margin-top:1rem;">
      <button type="submit" style="font:inherit;cursor:pointer;padding:0.5rem 1rem;background:#1d4ed8;color:#fff;border:none;border-radius:6px;">
        Fortsæt til booking
      </button>
    </p>
  </form>
  <p style="color:#666;font-size:14px;margin-top:1rem;">
    Hvis du ikke viderestilles automatisk, brug knappen ovenfor eller
    <a href="${procEsc}" style="color:#1d4ed8;">åbn Halbooking direkte</a>.
  </p>
  <script src="/hb-submit.js"></script>
</body>
</html>`;

    sendHtml(res, 200, body);
  } catch (e) {
    console.error('halbooking-open-padel', e);
    const errMsg = globalThis.process?.env?.NODE_ENV === 'production'
      ? 'Intern fejl – prøv igen senere'
      : escAttr(e.message || 'ukendt');
    sendHtml(
      res,
      500,
      `<!DOCTYPE html><html><body><p>Fejl: ${errMsg}</p></body></html>`
    );
  }
}
