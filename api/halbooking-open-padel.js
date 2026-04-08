/**
 * Auto-POST til Halbooking med valgt område (POST som dropdown).
 *
 * GET /api/halbooking-open-padel?venue=skansen_ntsc&pm_bane=...&pm_tid=...
 */

import { collectInputFields } from './lib/halbookingFetch.js';
import { readHalbookingHtml } from './lib/halbookingEncoding.js';
import { getAllowlistedVenue } from './lib/halbookingVenuesAllowlist.js';

const UA = 'PadelMakkerOpenPadel/1.0 (+https://www.padelmakker.dk)';

function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'GET') {
    sendText(res, 405, 'Method not allowed', { Allow: 'GET' });
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
    const firstRes = await fetch(PROC_BANER, {
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
    params.set('mf_funktion', 'omr_soeg');
    params.set('mf_para1', '');
    params.set('mf_para2', '');
    params.set('mf_para3', '');
    params.set('mf_para4', '');

    const pmBane = qs.get('pm_bane');
    const pmTid = qs.get('pm_tid');
    if (pmBane != null && String(pmBane).trim() !== '') {
      params.set('pm_bane', String(pmBane).slice(0, 120));
    }
    if (pmTid != null && String(pmTid).trim() !== '') {
      params.set('pm_tid', String(pmTid).slice(0, 20));
    }

    let hidden = '';
    for (const [name, value] of params.entries()) {
      hidden += `<input type="hidden" name="${escAttr(name)}" value="${escAttr(value)}"/>`;
    }

    const body = `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Viderestiller til booking…</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:1.5rem;max-width:32rem;">
  <p>Åbner Halbooking…</p>
  <p style="color:#666;font-size:14px;">Hvis intet sker, <button type="submit" form="pm-hb-padel" style="font:inherit;cursor:pointer;color:#1d4ed8;text-decoration:underline;background:none;border:none;padding:0;">klik her</button>.</p>
  <form id="pm-hb-padel" method="post" action="${PROC_BANER}" accept-charset="iso-8859-1">
    ${hidden}
  </form>
  <script>document.getElementById("pm-hb-padel").submit();</script>
</body>
</html>`;

    sendHtml(res, 200, body);
  } catch (e) {
    console.error('halbooking-open-padel', e);
    sendHtml(
      res,
      500,
      `<!DOCTYPE html><html><body><p>Fejl: ${escAttr(e.message || 'ukendt')}</p></body></html>`
    );
  }
}
