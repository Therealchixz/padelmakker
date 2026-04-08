/**
 * Halbooking-venues vist under Baner (synkroniser med api/lib/halbookingVenuesAllowlist.js).
 * Tilføj ny bane: begge steder + evt. CSP form-action i vercel.json.
 */

/** @typedef {{ id: string, title: string, address: string, indoor: boolean, region: string }} HalVenueMeta */

/** @type {HalVenueMeta[]} */
export const HALBOOKING_VENUES = [
  {
    id: 'skansen_ntsc',
    title: 'Skansen Padel',
    address: 'Lerumbakken 11, 9400 Nørresundby',
    indoor: false,
    region: 'Nordjylland',
  },
  {
    id: 'padel_lounge_aalborg',
    title: 'Padel Lounge Aalborg',
    address: 'Poul Larsens vej 36, Aalborg',
    indoor: true,
    region: 'Nordjylland',
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
