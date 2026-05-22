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
  matchi_vissenbjerg_padel: {
    facilityId: '3112',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vissenbjergpadel',
  },
  matchi_breintholt_esbjerg: {
    facilityId: '2232',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/breinhotlgardpadel',
  },
  matchi_k7_padel_losning: {
    facilityId: '2650',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/k7-padel',
  },
  matchi_nr_lyndelse_padel: {
    facilityId: '870',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/NrLyndelsePadeltennis',
  },
  matchi_padelyard: {
    facilityId: '917',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelyard',
  },
  matchi_padel4alle: {
    facilityId: '2364',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/Padel4alle',
  },
  matchi_padelnorth: {
    facilityId: '2810',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/padelnorth',
  },
  matchi_vipadelslagelse: {
    facilityId: '1925',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/vipadelslagelse',
  },
  matchi_racketclub_taastrup: {
    facilityId: '2262',
    sport: '5',
    indoorQuery: '',
    bookingUrl: 'https://www.matchi.se/facilities/RacketClubTaastrup',
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
