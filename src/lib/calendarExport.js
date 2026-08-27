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

export function buildGoogleCalendarUrl({ title, start, end, location, description }) {
  const dtEnd = end && end.isValid ? end : start.plus({ minutes: 90 });
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title || 'Padelkamp',
    dates: `${fmtUtc(start)}/${fmtUtc(dtEnd)}`,
    location: location || '',
    details: description || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function isIosCalendarClient() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function isAndroidCalendarClient() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

/** HTTPS .ics som iOS kan åbne med "Tilføj" (data:-URL'er ignoreres i PWA/iOS 17+). */
export function buildCalendarIcsUrl({ uid, title, start, end, location, description, url } = {}) {
  if (!start || !start.isValid) return '';
  const dtEnd = end && end.isValid ? end : start.plus({ minutes: 90 });
  const params = new URLSearchParams();
  params.set('uid', String(uid || `pm-${start.toMillis()}@padelmakker.dk`).slice(0, 160));
  params.set('title', String(title || 'Padelkamp').slice(0, 160));
  params.set('start', fmtUtc(start));
  params.set('end', fmtUtc(dtEnd));
  if (location) params.set('location', String(location).slice(0, 200));
  if (description) params.set('description', String(description).slice(0, 900));
  if (url) params.set('page', String(url).slice(0, 400));
  return `/kamp.ics?${params.toString()}`;
}

function openIosCalendarUrl(icsUrl) {
  // Skjulte <a>-klik ignorerer iOS. Samme-vindue https://…/.ics lader Safari vise Tilføj.
  window.location.assign(icsUrl);
}

/**
 * Åbn kalenderen med eventet.
 * iOS: rigtig https://…/kamp.ics (Safari viser "Tilføj til Kalender").
 * Android: Google Kalender-skabelon. Desktop: .ics-download.
 * @returns {'opened-ios'|'opened'|'download'|false}
 */
export function openCalendarInvite({
  ics,
  fileName,
  title,
  start,
  end,
  location,
  description,
  uid,
  url,
}) {
  if (typeof window === 'undefined') return false;
  const icsName = String(fileName || 'padelkamp.ics').endsWith('.ics')
    ? String(fileName || 'padelkamp.ics')
    : `${fileName}.ics`;

  if (isIosCalendarClient()) {
    const icsUrl = buildCalendarIcsUrl({ uid, title, start, end, location, description, url });
    if (!icsUrl) return false;
    openIosCalendarUrl(icsUrl);
    return 'opened-ios';
  }

  if (isAndroidCalendarClient()) {
    const googleUrl = buildGoogleCalendarUrl({ title, start, end, location, description });
    const popup = window.open(googleUrl, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.assign(googleUrl);
    return 'opened';
  }

  return downloadIcs(icsName, ics) ? 'download' : false;
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
  return openCalendarInvite({
    ics,
    fileName: `padelkamp-${date}`,
    title: title || 'Padelkamp',
    start,
    end,
    location: court || '',
    description: description || '',
    uid: `pm-match-${id || start.toMillis()}@padelmakker`,
  });
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
  return openCalendarInvite({
    ics,
    fileName: `${(name || 'turnering').replace(/[^\w-]+/g, '-')}-${date}`,
    title: name || 'Turnering',
    start,
    end,
    location: location || '',
    description: '',
    uid: `pm-tournament-${id || start.toMillis()}@padelmakker`,
  });
}
