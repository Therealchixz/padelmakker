/**
 * Tilladte MATCHi-faciliteter (server-side hentning af /book/schedule HTML).
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
    bookingUrl: 'https://www.matchi.se/facilities/SkagenPadelcenter',
  },
  matchi_padelnord: {
    facilityId: '2445',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelnord',
  },
  matchi_padel8500: {
    facilityId: '2229',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padel8500',
  },
  matchi_padelland: {
    facilityId: '2072',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Padelland',
  },
  matchi_vipadelaarhus: {
    facilityId: '1062',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/ViPadelAarhus',
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
