/**
 * Henter padel-kalender fra en Halbooking proc_baner.asp via POST omr_soeg.
 */

import { readHalbookingHtml } from './halbookingEncoding.js';

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

/**
 * Udtræk YYYY-MM-DD fra dateLabel (fx "mandag d. 8.4.2026" eller ISO-dato i teksten).
 * Bruges til at skjule tider før "nu" på dagens dato.
 */
export function parseScheduleDateYmd(dateLabel) {
  if (!dateLabel || typeof dateLabel !== 'string') return null
  const iso = dateLabel.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dm = dateLabel.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/)
  if (dm) {
    const d = parseInt(dm[1], 10)
    const mo = parseInt(dm[2], 10)
    const y = parseInt(dm[3], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  return null
}

/**
 * Tidsakse: Halbooking bruger typisk venstre kolonne (`lefthead`) med
 * `<div title='HH:MM' class='... banetid-...'>`. Padel Lounge bruger **div**,
 * ikke samme mønster som NTSC (kun `title='tid'` før `class` med banetid).
 */
export function parseTimes(html) {
  const owlIdx = html.indexOf("id='owl-kalender'");
  const beforeOwl = owlIdx >= 0 ? html.slice(0, owlIdx) : html;
  const leftMark = "pull-left lefthead";
  const leftIdx = beforeOwl.lastIndexOf(leftMark);
  const times = [];

  if (leftIdx >= 0) {
    const leftBlock = beforeOwl.slice(leftIdx);
    const divRe = /<div[^>]+>/gi;
    let dm;
    while ((dm = divRe.exec(leftBlock))) {
      const tag = dm[0];
      if (!/banetid/i.test(tag)) continue;
      const tm = tag.match(/\btitle=['"](\d{2}:\d{2})['"]/i);
      if (tm) times.push(tm[1]);
    }
  }

  if (times.length === 0) {
    const re = /<div[^>]*title='(\d{2}:\d{2})'[^>]*class='[^']*banetid[^']*'/gi;
    let m;
    while ((m = re.exec(html))) {
      times.push(m[1]);
    }
  }

  return times;
}

/** Titel på celle (fx "Ledig, men kan ikke bookes …") */
function attrTitle(attrs) {
  let m = attrs.match(/\btitle="([^"]*)"/i);
  if (m) return m[1];
  m = attrs.match(/\btitle='([^']*)'/i);
  return m ? m[1] : '';
}

/** Halbooking lægger ofte forklaringen i `data-tekst` (titlen kan være tom). */
function attrDataTekst(attrs) {
  let m = attrs.match(/\bdata-tekst='([^']*)'/i);
  if (m) return m[1];
  m = attrs.match(/\bdata-tekst="([^"]*)"/i);
  return m ? m[1] : '';
}

function cellHintText(attrs) {
  const title = (attrTitle(attrs) || '').trim();
  const dt = (attrDataTekst(attrs) || '').trim();
  return title || dt || '';
}

/**
 * Padel Lounge m.fl.: `bane_ledig_streg` = "ser ledig ud" men med modal-tekst om regler (ikke `btn_ledig`).
 * `btn_ledig` + titel/data om regler → `blocked_rule`.
 */
function statusFromSlotAttrs(attrs) {
  const a = attrs.toLowerCase();
  const hintRaw = cellHintText(attrs);
  const t = hintRaw.toLowerCase();

  if (a.includes('bane_redbg')) return { status: 'booked', ruleHint: null };
  if (a.includes('bane_rest')) return { status: 'unavailable', ruleHint: null };

  if (a.includes('bane_ledig_streg')) {
    return {
      status: 'blocked_rule',
      ruleHint: hintRaw || 'Kan ikke bookes (klubbens regel)',
    };
  }

  if (a.includes('btn_ledig')) {
    if (t.includes('booket')) return { status: 'booked', ruleHint: null };
    if (t.includes('passeret')) return { status: 'unavailable', ruleHint: null };
    if (t.includes('kan ikke book') || t.includes('ikke book')) {
      return {
        status: 'blocked_rule',
        ruleHint: hintRaw || 'Kan ikke bookes (klubbens regel)',
      };
    }
    return { status: 'free', ruleHint: null };
  }
  return { status: 'other', ruleHint: null };
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

    const slotRe = /<span([^>]*\bbanefelt[^>]*\bsize12[^>]*)>/gi;
    const spanAttrs = [];
    let sm;
    while ((sm = slotRe.exec(chunk))) {
      spanAttrs.push(sm[1]);
    }

    courts.push({ name: courtName, spanAttrs });
  }

  return { courts, error: null };
}

function median(nums) {
  if (nums.length === 0) return 52;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Én rækkes højde (fx 40 px Padel Lounge, 52 px NTSC) ud fra spans i en kolonne */
function guessRowHeightPx(spanAttrs) {
  const heights = [];
  for (const a of spanAttrs) {
    const hm = a.match(/style=['"][^'"]*height:\s*(\d+)px/i);
    if (hm) heights.push(parseInt(hm[1], 10));
  }
  const singles = heights.filter((h) => h >= 30 && h <= 90);
  return singles.length ? median(singles) : 52;
}

/**
 * Ekspanderer merged cells (height = N * rowHeight) til én status pr. tidsrække,
 * og aligner med venstre kolonne (forreste tomme rækker = "unavailable").
 */
function expandAndAlignStatuses(spanAttrs, nTimes) {
  const rowH = guessRowHeightPx(spanAttrs);
  const expanded = [];
  for (const a of spanAttrs) {
    const hm = a.match(/style=['"][^'"]*height:\s*(\d+)px/i);
    const h = hm ? parseInt(hm[1], 10) : rowH;
    const rows = Math.max(1, Math.round(h / rowH));
    const cell = statusFromSlotAttrs(a);
    for (let r = 0; r < rows; r++) expanded.push({ ...cell });
  }
  const pad = nTimes - expanded.length;
  if (pad > 0) {
    const padding = Array.from({ length: pad }, () => ({ status: 'unavailable', ruleHint: null }));
    return [...padding, ...expanded];
  }
  if (expanded.length > nTimes) {
    return expanded.slice(-nTimes);
  }
  return expanded;
}

function mergeSlots(times, courts) {
  const n = times.length;
  return courts.map((c) => {
    const rowCells = expandAndAlignStatuses(c.spanAttrs, n);
    const slots = [];
    for (let i = 0; i < n; i++) {
      const cell = rowCells[i] || { status: 'other', ruleHint: null };
      slots.push({
        time: times[i],
        status: cell.status,
        ...(cell.ruleHint ? { ruleHint: cell.ruleHint } : {}),
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

  const html0 = await readHalbookingHtml(firstRes);
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

  const html = await readHalbookingHtml(secondRes);
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
