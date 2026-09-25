/**
 * Ret en oprettet kamp: bane, dato og tid.
 *
 * Ejeren 25. sep. 2026: "Hvis man starter en kamp uden at have valgt en bane,
 * har man ikke mulighed for at gå tilbage og ændre det, hvis man finder en
 * bane, eller man vil ændre tiden." Kun opretteren, og kun før kampen er
 * startet. De andre spillere får besked (notifikation + kamp-chatten).
 *
 * Ingen "Har du booket?"-knap her: man vælger bare banen, man skal spille på
 * (valgt bane = booket). Findes banen ikke på listen, kan navnet skrives selv.
 *
 * Ren logik uden supabase, så den kan testes fra node.
 */

import {
  MATCH_VENUE_CUSTOM,
  MATCH_VENUE_TBD,
  cleanCustomCourtName,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
  isMatchVenueCustom,
  isMatchVenueTbd,
} from './matchVenueOptions.js';
import { parseMatchLevelRange } from './matchLevelRange.js';
import { shareWhenLabel } from './matchShareText.js';

export const EDIT_DURATIONS = [60, 90, 120, 150, 180];

function clock(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

function minutes(value) {
  const c = clock(value);
  if (!c) return null;
  const [h, m] = c.split(':').map(Number);
  return h * 60 + m;
}

/** Kan kampen rettes? Kun opretteren, og kun mens den er åben eller fuld. */
export function canEditMatch({ isCreator, status }) {
  return Boolean(isCreator) && (status === 'open' || status === 'full');
}

/**
 * Startværdier til ret-formularen ud fra kampen.
 * @param {object} match række fra matches
 * @param {{ id: string, label: string, courtId: string | null }[]} venueOptions
 */
export function initialMatchEditForm(match, venueOptions = []) {
  const courtId = match?.court_id ? String(match.court_id) : '';
  const courtName = String(match?.court_name || '').trim().toLowerCase();
  const byId = courtId ? venueOptions.find((o) => String(o.courtId || '') === courtId) : null;
  const byName = !byId && courtName ? venueOptions.find((o) => String(o.label || '').trim().toLowerCase() === courtName) : null;
  const rawName = String(match?.court_name || '').trim();
  const known = (byId || byName)?.id;
  // Et navn uden match på listen er en selvskrevet bane.
  const venue = known || (rawName && rawName.toLowerCase() !== 'padel' ? MATCH_VENUE_CUSTOM : MATCH_VENUE_TBD);
  const start = minutes(match?.time);
  const end = minutes(match?.time_end);
  let duration = 120;
  if (start != null && end != null) {
    const d = (end - start + 24 * 60) % (24 * 60);
    if (EDIT_DURATIONS.includes(d)) duration = d;
  }
  return {
    venue,
    custom_court: isMatchVenueCustom(venue) ? rawName : '',
    date: String(match?.date || '').slice(0, 10),
    time: clock(match?.time) || '18:00',
    duration: String(duration),
  };
}

/**
 * Lav ændringerne (til update_match_details). Niveauet bevares i databasen;
 * kun "booket"-mærket skiftes.
 * @returns {{ patch: object | null, error: string, field?: string }}
 */
export function buildMatchEditPatch(form, match, venueOptions = [], now = new Date()) {
  const date = String(form?.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { patch: null, error: 'Vælg en dato.', field: 'date' };
  const startM = minutes(form?.time);
  if (startM == null) return { patch: null, error: 'Vælg en starttid.', field: 'time' };
  const dur = parseInt(form?.duration, 10);
  if (!dur || dur < 60) return { patch: null, error: 'Varighed skal være mindst 1 time.', field: 'duration' };

  // Ikke tilbage i tiden (lokal tid som i opret-guiden).
  const [y, mo, d] = date.split('-').map(Number);
  const startAt = new Date(y, mo - 1, d, Math.floor(startM / 60), startM % 60);
  if (startAt.getTime() < now.getTime()) {
    return { patch: null, error: 'Tidspunktet er allerede passeret. Vælg et senere tidspunkt.', field: 'time' };
  }

  const venue = form?.venue || MATCH_VENUE_TBD;
  const custom = isMatchVenueCustom(venue) ? cleanCustomCourtName(form?.custom_court) : '';
  if (isMatchVenueCustom(venue) && !custom) {
    return { patch: null, error: 'Skriv navnet på banen.', field: 'venue' };
  }
  const booked = !isMatchVenueTbd(venue);

  const endM = startM + dur;
  const time = clock(form.time);
  const timeEnd = `${String(Math.floor(endM / 60) % 24).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
  const courtId = booked && !custom ? courtIdFromVenueSelection(venue, venueOptions) : null;
  const courtName = custom || (booked ? courtNameFromVenueSelection(venue, venueOptions) : '');

  const patch = {
    date,
    time,
    time_end: timeEnd,
    court_id: courtId,
    court_name: courtName || '',
    court_booked: booked,
  };
  const before = {
    date: String(match?.date || '').slice(0, 10),
    time: clock(match?.time),
    time_end: clock(match?.time_end),
    court_id: match?.court_id || null,
    court_name: String(match?.court_name || ''),
    court_booked: parseMatchLevelRange(match?.level_range).booked === true,
  };
  const changed = Object.keys(patch).some((k) => String(patch[k] ?? '') !== String(before[k] ?? ''));
  if (!changed) return { patch: null, error: 'Du har ikke ændret noget.' };
  return { patch, error: '' };
}

/** Beskeden i kamp-chatten, fx "Kampen er ændret: onsdag 30. sep kl. 19:00–21:00 · Skansen Padel (booket)". */
export function matchEditChatMessage(patch) {
  const when = shareWhenLabel({ date: patch?.date, time: patch?.time, time_end: patch?.time_end });
  const booked = patch?.court_booked === true;
  const court = String(patch?.court_name || '').trim();
  const where = court ? `${court}${booked ? ' (booket)' : ''}` : 'Bane ikke valgt endnu';
  return `📅 Kampen er ændret: ${when} · ${where}`;
}

/** Teksten i notifikationen, fx "Mike har flyttet kampen: torsdag 1. okt kl. 20:00–21:30 · Skansen Padel (booket)". */
export function matchEditNotificationBody(patch, creatorName) {
  const who = String(creatorName || '').trim().split(/\s+/)[0] || 'Opretteren';
  return `${who} har ændret kampen: ${matchEditChatMessage(patch).replace(/^📅 Kampen er ændret: /, '')}`;
}
