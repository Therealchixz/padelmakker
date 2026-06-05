/**
 * Kalender-eksport (.ics) — "Tilføj til kalender".
 *
 * Ren klient-side: bygger en RFC5545 VCALENDAR og lader browseren downloade/åbne den.
 * Kampe gemmer lokal dato (YYYY-MM-DD) + tid (HH:MM) i Europe/Copenhagen, så vi
 * konverterer til UTC med luxon før .ics (kalender-apps forventer UTC med 'Z').
 */
import { DateTime } from 'luxon';

const ZONE = 'Europe/Copenhagen';

function fmtUtc(dt) {
  return dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function escapeIcs(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC5545: fold lange linjer til <=75 oktetter (simpel ASCII-fold). */
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

/** Lav en luxon DateTime ud fra Københavns-lokal dato + tid. */
export function copenhagenLocalDateTime(dateYmd, timeHm) {
  if (!dateYmd) return null;
  const t = timeHm && /^\d{1,2}:\d{2}/.test(timeHm) ? timeHm : '00:00';
  const dt = DateTime.fromISO(`${dateYmd}T${t}`, { zone: ZONE });
  return dt.isValid ? dt : null;
}

/** Byg en .ics-streng for ét event. start/end er luxon DateTimes. */
export function buildIcs({ uid, title, description, location, start, end }) {
  const dtStart = start;
  const dtEnd = end && end.isValid ? end : start.plus({ minutes: 90 });
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMakker//DA//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(DateTime.utc())}`,
    `DTSTART:${fmtUtc(dtStart)}`,
    `DTEND:${fmtUtc(dtEnd)}`,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : null,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(foldLine);
  return lines.join('\r\n');
}

/** Trigger download/åbning af en .ics-fil. */
export function downloadIcs(filename, ics) {
  try {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/** Læg en padelkamp i kalenderen. Returnerer false hvis dato/tid mangler. */
export function addMatchToCalendar({ id, title, date, time, timeEnd, court, description }) {
  const start = copenhagenLocalDateTime(date, time);
  if (!start) return false;
  const end = timeEnd ? copenhagenLocalDateTime(date, timeEnd) : null;
  const ics = buildIcs({
    uid: `pm-match-${id || start.toMillis()}@padelmakker`,
    title: title || 'Padelkamp',
    description: description || '',
    location: court || '',
    start,
    end,
  });
  return downloadIcs(`padelkamp-${date}`, ics);
}

/** Læg en turnering (Americano/Mexicano/Liga) i kalenderen. */
export function addTournamentToCalendar({ id, name, date, time, location, durationHours = 2 }) {
  const start = copenhagenLocalDateTime(date, time);
  if (!start) return false;
  const end = start.plus({ hours: durationHours });
  const ics = buildIcs({
    uid: `pm-tournament-${id || start.toMillis()}@padelmakker`,
    title: name || 'Turnering',
    description: '',
    location: location || '',
    start,
    end,
  });
  return downloadIcs(`${(name || 'turnering').replace(/[^\w-]+/g, '-')}-${date}`, ics);
}
