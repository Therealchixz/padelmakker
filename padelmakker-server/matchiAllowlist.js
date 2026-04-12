/**
 * Tilladte MATCHi-faciliteter (server-side hentning af /book/schedule HTML).
 * facilityId findes på facilitetssiden (fx i favorit-link eller inline script).
 */

/** @typedef {{ facilityId: string; sport: string; indoorQuery: string; bookingUrl: string }} MatchiVenueConfig */

/** @type {Record<string, MatchiVenueConfig>} */
export const MATCHI_VENUE_ALLOWLIST = {
  matchi_padel99: {
    facilityId: '2840',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel99',
  },
  matchi_skagen_padelcenter: {
    facilityId: '2430',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/SkagenPadelcenter%20',
  },
};

const MATCHI_ORIGIN = 'https://www.matchi.se';

export function getMatchiVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return MATCHI_VENUE_ALLOWLIST[venueId] || null;
}

export function matchiScheduleUrl(cfg, dateYmd) {
  const q = new URLSearchParams();
  q.set('facilityId', cfg.facilityId);
  q.set('date', dateYmd);
  q.set('sport', cfg.sport);
  q.set('week', '');
  q.set('year', '');
  const tail = cfg.indoorQuery || '';
  return `${MATCHI_ORIGIN}/book/schedule?${q.toString()}${tail ? `&${tail.replace(/^&/, '')}` : ''}`;
}
