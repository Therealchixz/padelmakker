/**
 * GET /api/calendar.ics — ét VEVENT som text/calendar.
 * iOS Safari/PWA ignorerer data:-URL'er, men åbner Tilføj-kalender for rigtige .ics-svar.
 */

const DT_UTC = /^\d{8}T\d{6}Z$/;

function clip(value, max) {
  return String(value ?? '').slice(0, max);
}

function escapeIcs(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 73) return line;
  const out = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    out.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
}

function readParams(req) {
  const fromQuery = req?.query && typeof req.query === 'object' ? req.query : null;
  if (fromQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fromQuery)) {
      if (key === 'slug') continue;
      if (typeof value === 'string') params.set(key, value);
      else if (Array.isArray(value) && typeof value[0] === 'string') params.set(key, value[0]);
    }
    if ([...params.keys()].some((key) => key !== 'slug')) return params;
  }
  const raw = String(req?.url || '');
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return new URLSearchParams(q);
}

export function buildIcsFromQuery(params) {
  const start = String(params.get('start') || '');
  const end = String(params.get('end') || '');
  if (!DT_UTC.test(start) || !DT_UTC.test(end)) return null;

  const uidRaw = clip(params.get('uid') || `pm-${start}@padelmakker.dk`, 160);
  const uid = uidRaw.replace(/[^a-zA-Z0-9@._-]/g, '') || `pm-${start}@padelmakker.dk`;
  const title = clip(params.get('title') || 'Padelkamp', 160);
  const location = clip(params.get('location') || '', 200);
  const description = clip(params.get('description') || '', 900);
  const page = clip(params.get('page') || '', 400);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMakker//DA//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : null,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    page ? `URL:${escapeIcs(page)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(foldLine);

  return `${lines.join('\r\n')}\r\n`;
}

function send(res, status, headers, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.end(body);
}

export function handleCalendarIcs(req, res) {
  if (req.method === 'OPTIONS') {
    send(res, 204, { Allow: 'GET, OPTIONS' }, '');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET' }, 'Method not allowed');
    return;
  }

  const ics = buildIcsFromQuery(readParams(req));
  if (!ics) {
    send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Ugyldig kalender-forespørgsel');
    return;
  }

  const headers = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="padelkamp.ics"',
    'Cache-Control': 'private, no-store',
  };
  send(res, 200, headers, req.method === 'HEAD' ? '' : ics);
}
