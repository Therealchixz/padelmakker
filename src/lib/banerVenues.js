import { DateTime } from 'luxon';

/**
 * Alle steder under fanen Baner.
 * Halbooking: id skal matche api/lib/halbookingVenuesAllowlist.js
 * Bookli: id skal matche api/lib/bookliAllowlist.js
 */

/** @typedef {{ kind: 'halbooking', id: string, title: string, address: string, indoor: boolean, region: string }} HalbookingVenue */
/** @typedef {{ kind: 'bookli', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, infoUrl: string }} BookliVenue */
/** @typedef {{ kind: 'link', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, note?: string }} LinkVenue */
/** @typedef {HalbookingVenue | BookliVenue | LinkVenue} BanerVenue */

/** @type {BanerVenue[]} */
export const BANER_VENUES = [
  {
    kind: 'halbooking',
    id: 'skansen_ntsc',
    title: 'Skansen Padel',
    address: 'Lerumbakken 11, 9400 Nørresundby',
    indoor: false,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'padel_lounge_aalborg',
    title: 'Padel Lounge Aalborg',
    address: 'Poul Larsens vej 36, Aalborg',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'match_padel_halbooking',
    title: 'Match Padel',
    address: 'Via Halbooking — se matchpadel.dk',
    indoor: true,
    region: 'Danmark',
  },
  {
    kind: 'bookli',
    id: 'padelpadel_aalborg',
    title: 'PadelPadel Aalborg (AL Bank Arena)',
    address: 'Hellebarden 2, 9230 Svenstrup J',
    indoor: true,
    region: 'Nordjylland',
    /** Opret booking (kræver login) — samme flow som på padelpadel.dk */
    bookingUrl: 'https://bookli.app/u/booking/create',
    infoUrl: 'https://padelpadel.dk/vores-centre/aalborg/',
  },
  {
    kind: 'halbooking',
    id: 'himmerland_halbooking',
    title: 'HimmerLand padel (Halbooking)',
    address: 'HimmerLand, Gatten (se himmerland.dk)',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'halbooking',
    id: 'sportshallen_frederikshavn_halbooking',
    title: 'Sportshallen Frederikshavn — padel (Halbooking)',
    address: 'Via Halbooking — Frederikshavn',
    indoor: true,
    region: 'Nordjylland',
  },
  {
    kind: 'link',
    id: 'matchi_padel99',
    title: 'Padel99 (Matchi)',
    address: 'Se booking på Matchi',
    indoor: true,
    region: 'Nordjylland',
    bookingUrl: 'https://www.matchi.se/facilities/padel99',
    note:
      'Matchi har ikke integreret kalender i PadelMakker. Tryk Åbn booking for at se ledige tider på matchi.se (ofte efter login).',
  },
  {
    kind: 'link',
    id: 'aarstennisklub_booking',
    title: 'Aars Tennis & Padel',
    address: 'Aars — se aarstennisklub.dk',
    indoor: false,
    region: 'Nordjylland',
    bookingUrl:
      'https://www.aarstennisklub.dk/Activity/BookingView/Activity2518183623424373632',
    note:
      'Klubbens eget bookingsystem (Memberlink) — ingen tidsliste her. Tryk Åbn booking for at se ledige tider på deres site.',
  },
  {
    kind: 'link',
    id: 'gug_tennis_padel_booking',
    title: 'Gug Tennis & Padel',
    address: 'Gug, Aalborg — se gugtennisogpadel.dk',
    indoor: true,
    region: 'Nordjylland',
    bookingUrl:
      'https://gugtennisogpadel.memberlink.dk/Activity/BookingView/Activity2520021377950888076',
    note:
      'Memberlink — ingen tidsliste i PadelMakker. Tryk Åbn booking for at booke på klubbens site.',
  },
  {
    kind: 'link',
    id: 'matchi_skagen_padelcenter',
    title: 'Skagen Padelcenter (Matchi)',
    address: 'Skagen — se Matchi',
    indoor: false,
    region: 'Nordjylland',
    bookingUrl: 'https://www.matchi.se/facilities/SkagenPadelcenter%20',
    note:
      'Matchi — ingen integreret kalender her. Tryk Åbn booking for at se tider på matchi.se.',
  },
];

const SLOTS_BASE =
  (import.meta.env.VITE_HALBOOKING_SLOTS_URL && String(import.meta.env.VITE_HALBOOKING_SLOTS_URL).trim()) ||
  '/api/halbooking-slots';

const BOOKLI_SLOTS_BASE =
  (import.meta.env.VITE_BOOKLI_SLOTS_URL && String(import.meta.env.VITE_BOOKLI_SLOTS_URL).trim()) ||
  '/api/bookli-slots';

/**
 * @param {string} venueId
 * @param {string} [dateYmd] - YYYY-MM-DD (Europe/Copenhagen)
 */
export function halbookingSlotsUrl(venueId, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  if (dateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmd).trim())) {
    q.set('date', String(dateYmd).trim());
  }
  return `${SLOTS_BASE}?${q.toString()}`;
}

/**
 * @param {string} venueId
 * @param {string} dateYmd
 */
export function bookliSlotsUrl(venueId, dateYmd) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  q.set('date', dateYmd);
  return `${BOOKLI_SLOTS_BASE}?${q.toString()}`;
}

/** I dag som YYYY-MM-DD i Europe/Copenhagen (til date-input default). */
export function copenhagenDateYmd() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
}

/** Flyt en kalenderdag i Europe/Copenhagen (til Halbooking-dato). */
export function copenhagenAddDaysYmd(ymd, deltaDays) {
  const d = DateTime.fromISO(String(ymd || '').trim(), { zone: 'Europe/Copenhagen' });
  if (!d.isValid) return copenhagenDateYmd();
  return d.plus({ days: deltaDays }).toFormat('yyyy-MM-dd');
}

/**
 * @param {string} venueId
 * @param {string} courtName
 * @param {string} time
 */
export function halbookingOpenUrl(venueId, courtName, time) {
  const q = new URLSearchParams();
  q.set('venue', venueId);
  q.set('pm_bane', courtName);
  q.set('pm_tid', time);
  return `/api/halbooking-open-padel?${q.toString()}`;
}

/**
 * @param {string} venueId
 */
export function halbookingOpenVenueUrl(venueId) {
  return `/api/halbooking-open-padel?venue=${encodeURIComponent(venueId)}`;
}
