/**
 * Parser MATCHi /book/schedule HTML (samme fragment som jQuery.ajax på facilitetssiden).
 */

const UA = 'PadelMakkerMatchi/1.0 (+https://www.padelmakker.dk)';

/** @param {string} t "HH:MM" */
function parseMinutes(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** @param {number} min */
function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Finder index for `>` der lukker `<td ...>` (ignorerer `>` inde i attribut-citater).
 * @param {string} s
 * @param {number} tdLt index af '<' i `<td`
 */
function findTdTagEnd(s, tdLt) {
  let i = tdLt + 1;
  const len = s.length;
  let inDq = false;
  let inSq = false;
  while (i < len) {
    const c = s[i];
    if (inDq) {
      if (c === '"') inDq = false;
      i++;
      continue;
    }
    if (inSq) {
      if (c === "'") inSq = false;
      i++;
      continue;
    }
    if (c === '"') {
      inDq = true;
      i++;
      continue;
    }
    if (c === "'") {
      inSq = true;
      i++;
      continue;
    }
    if (c === '>') return i;
    i++;
  }
  return -1;
}

function normalizeHhMm(s) {
  const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = m[2];
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, '0')}:${mm}`;
}

/**
 * @param {string} title
 * @returns {{ start: string, end: string } | null}
 */
function parseTitleRange(title) {
  const raw = String(title || '').replace(/<br\s*\/?>/gi, ' ');
  const m = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  const start = normalizeHhMm(m[1]);
  const end = normalizeHhMm(m[2]);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * @param {string} html
 * @param {string} dateYmd
 */
export function parseMatchiScheduleHtml(html, dateYmd) {
  if (!html || typeof html !== 'string') {
    return { error: 'Tomt svar fra MATCHi', courts: [], dateLabel: null };
  }
  if (!html.includes('schedule-table') && !html.includes('table-bordered daily')) {
    return { error: 'Uventet svar fra MATCHi (ingen kalender)', courts: [], dateLabel: null };
  }

  const dateLabelMatch = html.match(/>\s*([A-Za-zåäöÅÄÖøØæÆ]+ \d{1,2} [A-Za-zåäöÅÄÖøØæÆ]+)\s*</);
  const weekMatch = html.match(/week\s+(\d+)/i);
  const dateLabel =
    dateLabelMatch && weekMatch
      ? `${dateLabelMatch[1].trim()} · uge ${weekMatch[1]}`
      : dateLabelMatch
        ? dateLabelMatch[1].trim()
        : dateYmd;

  /** Én banerække slutter med lukning af indre tabel: `</table></td></tr>` (indre `<tr>…</tr>` må ikke afkorte). */
  const rowRe = /<tr[^>]*\bheight=["']50["'][^>]*>([\s\S]*?)<\/table>\s*<\/td>\s*<\/tr>/gi;
  /** @type {{ name: string; intervals: { startMin: number; endMin: number; booked: boolean }[] }[]} */
  const courtRows = [];
  let rm;
  while ((rm = rowRe.exec(html))) {
    const chunk = rm[1];
    if (!/class="court"/.test(chunk)) continue;

    const courtCell = chunk.match(/<td class="court"[^>]*>([\s\S]*?)<\/td>/i);
    let name = 'Bane';
    if (courtCell) {
      name = courtCell[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!name) name = 'Bane';
    }

    const intervals = [];
    /** `<td` + `slotid="..."` — hele åbnings-tagget findes med citat-bevaring (title kan indeholde `<br>`). */
    const slotHeadRe = /<td(?:\s|[\r\n])+slotid="([^"]*)"/gi;
    let sm;
    while ((sm = slotHeadRe.exec(chunk))) {
      const tdLt = sm.index;
      const tagEnd = findTdTagEnd(chunk, tdLt);
      if (tagEnd < 0) continue;
      const attrs = chunk.slice(tdLt + 1, tagEnd);
      let title = '';
      const titleDq = attrs.match(/\btitle="([\s\S]*?)"/i);
      const titleSq = attrs.match(/\btitle='([\s\S]*?)'/i);
      if (titleDq) title = titleDq[1];
      else if (titleSq) title = titleSq[1];
      const cls = (attrs.match(/\bclass="([^"]*)"/i) || [])[1] || '';
      const range = parseTitleRange(title);
      if (!range) continue;
      const startMin = parseMinutes(range.start);
      const endMin = parseMinutes(range.end);
      if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;
      const booked = /\bred\b/i.test(cls) || /booked/i.test(title);
      const free = /\bfree\b/i.test(cls) || /available/i.test(title);
      if (!booked && !free) continue;
      intervals.push({ startMin, endMin, booked: !!booked });
    }

    if (intervals.length > 0) {
      courtRows.push({ name, intervals });
    }
  }

  if (courtRows.length === 0) {
    return { error: 'Kunne ikke læse baner fra MATCHi-kalenderen', courts: [], dateLabel, date: dateYmd };
  }

  let dayStart = 24 * 60;
  let dayEnd = 0;
  for (const row of courtRows) {
    for (const iv of row.intervals) {
      dayStart = Math.min(dayStart, iv.startMin);
      dayEnd = Math.max(dayEnd, iv.endMin);
    }
  }
  const step = 30;
  dayStart = Math.floor(dayStart / step) * step;
  dayEnd = Math.ceil(dayEnd / step) * step;

  const courts = courtRows.map((row) => {
    /** @type {{ time: string; status: string }[]} */
    const slots = [];
    for (let t = dayStart; t < dayEnd; t += step) {
      const tEnd = t + step;
      let status = 'unavailable';
      for (const iv of row.intervals) {
        if (iv.startMin < tEnd && iv.endMin > t) {
          if (iv.booked) {
            status = 'booked';
            break;
          }
          status = 'free';
        }
      }
      slots.push({ time: formatMinutes(t), status });
    }
    return {
      name: row.name,
      slots,
      available: slots.filter((s) => s.status === 'free').map((s) => s.time),
    };
  });

  return { error: null, courts, dateLabel, date: dateYmd };
}

/**
 * @param {string} scheduleUrl full https://www.matchi.se/book/schedule?...
 */
export async function fetchMatchiSchedule(scheduleUrl) {
  const res = await fetch(scheduleUrl, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,*/*',
      'Accept-Language': 'da,en;q=0.9',
    },
  });
  if (!res.ok) {
    return { error: `MATCHi fejl: ${res.status}`, courts: [], dateLabel: null, date: null };
  }
  const html = await res.text();
  const dateParam = new URL(scheduleUrl).searchParams.get('date') || '';
  return parseMatchiScheduleHtml(html, dateParam);
}
