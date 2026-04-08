/**
 * Henter padel-kalender fra en Halbooking proc_baner.asp via POST omr_soeg.
 */

const UA = 'PadelMakkerHalbooking/1.0 (+https://www.padelmakker.dk)';

export function collectInputFields(formInner) {
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

export function parseDateLabel(html) {
  const m = html.match(/min420'>\s*-\s*([^<]+)<\/div>/);
  return m ? m[1].trim() : null;
}

export function parseTimes(html) {
  const times = [];
  const re = /<div[^>]*title='(\d{2}:\d{2})'[^>]*class='[^']*banetid[^']*'/gi;
  let m;
  while ((m = re.exec(html))) {
    times.push(m[1]);
  }
  return times;
}

export function parseCourts(html) {
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

/**
 * @param {string} procBanerUrl fuld URL til .../newlook/proc_baner.asp
 * @param {string} soegOmrAede Halbooking område-id (string)
 */
export async function fetchHalbookingPadelSchedule(procBanerUrl, soegOmrAede) {
  const firstRes = await fetch(procBanerUrl, {
    headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
  });
  if (!firstRes.ok) {
    return { error: `Halbooking fejl: ${firstRes.status}` };
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
    return { error: 'Kunne ikke finde booking-formular' };
  }

  const params = collectInputFields(formMatch[1]);
  params.set('soeg_omraede', String(soegOmrAede));
  params.set('mf_funktion', 'omr_soeg');
  params.set('mf_para1', '');
  params.set('mf_para2', '');
  params.set('mf_para3', '');
  params.set('mf_para4', '');

  const secondRes = await fetch(procBanerUrl, {
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
    return { error: `Halbooking POST fejl: ${secondRes.status}` };
  }

  const html = await secondRes.text();
  if (!html.includes("id='owl-kalender'")) {
    return { error: 'Uventet svar fra Halbooking (ingen kalender)' };
  }

  const dateLabel = parseDateLabel(html);
  const times = parseTimes(html);
  const { courts, error: parseErr } = parseCourts(html);
  if (parseErr || courts.length === 0) {
    return { error: parseErr || 'Ingen baner i kalender' };
  }

  const courtsOut = mergeSlots(times, courts);
  return {
    dateLabel,
    courts: courtsOut,
    procBanerUrl,
    soegOmrAede: String(soegOmrAede),
  };
}
