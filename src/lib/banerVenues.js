/**
 * Alle steder under fanen Baner.
 * Halbooking: id skal matche api/lib/halbookingVenuesAllowlist.js
 */

/** @typedef {{ kind: 'halbooking', id: string, title: string, address: string, indoor: boolean, region: string }} HalbookingVenue */
/** @typedef {{ kind: 'external', id: string, title: string, address: string, indoor: boolean, region: string, bookingUrl: string, infoUrl: string, bookingNote: string }} ExternalVenue */
/** @typedef {HalbookingVenue | ExternalVenue} BanerVenue */

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
    kind: 'external',
    id: 'padelpadel_aalborg',
    title: 'PadelPadel Aalborg (AL Bank Arena)',
    address: 'Hellebarden 2, 9230 Svenstrup J',
    indoor: true,
    region: 'Nordjylland',
    bookingUrl: 'https://bookli.app/u/home',
    infoUrl: 'https://padelpadel.dk/vores-centre/aalborg/',
    bookingNote:
      'PadelPadel bruger Bookli til booking — der er ikke direkte “klik på tid”-links som på Halbooking. Log ind på Bookli for at se ledige single- og doublebaner og booke. (Mødelokaler kan du ignorere i deres system.)',
  },
];

const SLOTS_BASE =
  (import.meta.env.VITE_HALBOOKING_SLOTS_URL && String(import.meta.env.VITE_HALBOOKING_SLOTS_URL).trim()) ||
  '/api/halbooking-slots';

/**
 * @param {string} venueId
 */
export function halbookingSlotsUrl(venueId) {
  return `${SLOTS_BASE}?venue=${encodeURIComponent(venueId)}`;
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
