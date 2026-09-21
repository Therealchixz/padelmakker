/**
 * Kalender-eksport for 2v2-kampe: tidsrum og ICS-tekst.
 *
 * Laa i KampeTab, men afhaenger hverken af komponentens tilstand eller af React.
 * Tiderne regnes i Europe/Copenhagen, fordi kampene er danske - en kamp kl. 19
 * er kl. 19 lokalt, uanset hvor brugeren aabner sin kalender.
 */
import { DateTime } from 'luxon';

export const CALENDAR_ZONE = 'Europe/Copenhagen';

export function parseMatchDateTime(matchDate, matchTime) {
  const dateIso = String(matchDate || '').slice(0, 10);
  const rawTime = String(matchTime || '').trim();
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(rawTime);
  if (!dateIso || !timeMatch) return null;

  const hours = Math.max(0, Math.min(23, Number(timeMatch[1])));
  const minutes = Math.max(0, Math.min(59, Number(timeMatch[2])));
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const dt = DateTime.fromISO(`${dateIso}T${hh}:${mm}:00`, { zone: CALENDAR_ZONE });
  return dt.isValid ? dt : null;
}

export function calendarWindowForMatch(match) {
  const start = parseMatchDateTime(match?.date, match?.time);
  if (!start) return null;

  let end = parseMatchDateTime(match?.date, match?.time_end);
  if (!end) {
    const duration = Number(match?.duration);
    const minutes = Number.isFinite(duration) && duration > 0 ? duration : 120;
    end = start.plus({ minutes });
  }
  if (end <= start) end = end.plus({ days: 1 });
  return { start, end };
}

export function escapeIcsText(value) {
  return String(value || '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function toIcsUtc(dt) {
  return dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

export function buildIcsEvent({ uid, title, description, location, start, end, url }) {
  const stamp = DateTime.utc().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMakker//Kampe//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${escapeIcsText(url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  return lines.join('\r\n');
}
