/**
 * Vercel serverless: henter padel-kalender fra NTSC Halbooking (Skansen Padel)
 * og returnerer ledige tider pr. bane. Ingen API-nøgle — HTML-scraping som deres eget site.
 *
 * GET /api/halbooking-skansen-padel
 */

const HAL_ORIGIN = 'https://ntsc.halbooking.dk';
const PROC_BANER = `${HAL_ORIGIN}/newlook/proc_baner.asp`;
const PADEL_OMRAEDE = '5';

const UA = 'PadelMakkerAvailability/1.0 (+https://www.padelmakker.dk)';

function collectInputFields(formInner) {
  const params = new URLSearchParams();
  const re = /<input[^>]*>/gi;
  let m;
  while ((m = re.exec(formInner))) {
    const tag = m[0];
    const nameMatch = tag.match(/\bname="([^"]+)"/i);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const valueMatch = tag.match(/\bvalue="([^"]*)"/i);
    params.set(name, valueMatch ? valueMatch[1] : '');
  }
  return params;
}

function parseDateLabel(html) {
  const m = html.match(/min420'>\s*-\s*([^<]+)<\/div>/);
  return m ? m[1].trim() : null;
}

function parseTimes(html) {
  const times = [];
  const re = /<div[^>]*title='(\d{2}:\d{2})'[^>]*class='[^']*banetid[^']*'/gi;
  let m;
  while ((m = re.exec(html))) {
    times.push(m[1]);
  }
  return times;
}

function parseCourts(html) {
  const owlIdx = html.indexOf("id='owl-kalender'");
  if (owlIdx < 0) return { courts: [], error: 'owl-kalender mangler' };

  const sub = html.slice(owlIdx);
  const endIdx = sub.indexOf("</div></div><div class='clearfix'");
  const owlHtml = endIdx > 0 ? sub.slice(0, endIdx) : sub;

  const parts = owlHtml.split(/<div class='text-center bane'/);
  const courts = [];

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const nameMatch = chunk.match(/baneheadtxt[^>]*>([^<]+)</);
    const courtName = nameMatch ? nameMatch[1].trim() : `Bane ${i}`;

    const slotRe = /<span[^>]*class='([^']*banefelt[^']*size12[^']*)'[^>]*>/gi;
    const statuses = [];
    let sm;
    while ((sm = slotRe.exec(chunk))) {
      const cls = sm[1];
      if (cls.includes('btn_ledig')) statuses.push('free');
      else if (cls.includes('bane_redbg')) statuses.push('booked');
      else if (cls.includes('bane_rest')) statuses.push('unavailable');
      else statuses.push('other');
    }

    courts.push({ name: courtName, statuses });
  }

  return { courts, error: null };
}

function mergeSlots(times, courts) {
  const n = times.length;
  return courts.map((c) => {
    const slots = [];
    for (let i = 0; i < Math.min(n, c.statuses.length); i++) {
      slots.push({
        time: times[i],
        status: c.statuses[i],
      });
    }
    return {
      name: c.name,
      slots,
      available: slots.filter((s) => s.status === 'free').map((s) => s.time),
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const firstRes = await fetch(PROC_BANER, {
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    });
    if (!firstRes.ok) {
      res.status(502).json({ error: `Halbooking fejl: ${firstRes.status}` });
      return;
    }

    const setCookie = firstRes.headers.get('set-cookie');
    const cookie =
      setCookie && typeof setCookie === 'string'
        ? setCookie
            .split(/,(?=[^;]+=)/)
            .map((p) => p.split(';')[0].trim())
            .join('; ')
        : '';

    const html0 = await firstRes.text();
    const formMatch = html0.match(/<form[^>]*id="multiform"[^>]*>([\s\S]*?)<\/form>/i);
    if (!formMatch) {
      res.status(502).json({ error: 'Kunne ikke finde booking-formular' });
      return;
    }

    const params = collectInputFields(formMatch[1]);
    params.set('soeg_omraede', PADEL_OMRAEDE);
    params.set('mf_funktion', 'omr_soeg');
    params.set('mf_para1', '');
    params.set('mf_para2', '');
    params.set('mf_para3', '');
    params.set('mf_para4', '');

    const secondRes = await fetch(PROC_BANER, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: params.toString(),
    });

    if (!secondRes.ok) {
      res.status(502).json({ error: `Halbooking POST fejl: ${secondRes.status}` });
      return;
    }

    const html = await secondRes.text();
    if (!/Padel/i.test(html) || !html.includes("id='owl-kalender'")) {
      res.status(502).json({ error: 'Uventet svar fra Halbooking (padel ikke valgt)' });
      return;
    }

    const dateLabel = parseDateLabel(html);
    const times = parseTimes(html);
    const { courts, error: parseErr } = parseCourts(html);
    if (parseErr || courts.length === 0) {
      res.status(502).json({ error: parseErr || 'Ingen baner i kalender' });
      return;
    }

    const courtsOut = mergeSlots(times, courts);

    res.status(200).json({
      source: 'ntsc_halbooking',
      area: 'padel_skansen',
      dateLabel,
      fetchedAt: new Date().toISOString(),
      bookingBaseUrl: PROC_BANER,
      /** Relativ sti på PadelMakker: auto-POST til Halbooking med Padel valgt. */
      bookingUrl: '/api/halbooking-open-padel',
      courts: courtsOut,
    });
  } catch (e) {
    console.error('halbooking-skansen-padel', e);
    res.status(500).json({ error: e.message || 'Ukendt fejl' });
  }
}
