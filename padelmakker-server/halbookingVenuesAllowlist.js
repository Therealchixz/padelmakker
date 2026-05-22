/**
 * Kun disse venue-id må bruges mod Halbooking (sikkerhed).
 * Tilføj samme id i src/lib/banerVenues.js
 */

const MATCH_PADEL_PROC = 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp';

export const HALBOOKING_VENUE_ALLOWLIST = {
  skansen_ntsc: {
    procBaner: 'https://ntsc.halbooking.dk/newlook/proc_baner.asp',
    omraede: '5',
  },
  padel_lounge_aalborg: {
    procBaner: 'https://padellounge.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  himmerland_halbooking: {
    procBaner: 'https://himmerland.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  sportshallen_frederikshavn_halbooking: {
    procBaner: 'https://sportshallen.halbooking.dk/newlook/proc_baner.asp',
    omraede: '2',
  },
  match_padel_aalborg: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '5',
  },
  match_padel_aarhus: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '1',
  },
  match_padel_odense: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '14',
  },
  match_padel_silkeborg: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '19',
  },
  match_padel_lemvig: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '8',
  },
  match_padel_hobro: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '11',
  },
};

export function getAllowlistedVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return HALBOOKING_VENUE_ALLOWLIST[venueId] || null;
}
