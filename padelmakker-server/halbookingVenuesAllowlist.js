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
  padelmaster_hadsten: {
    procBaner: 'https://padelmaster.halbooking.dk/newlook/proc_baner.asp',
    omraede: '',
  },
  xpadel_helsingor_halbooking: {
    procBaner: 'https://xpadel.halbooking.dk/newlook/proc_baner.asp',
    omraede: '1',
  },
  padelpit_roskilde_halbooking: {
    procBaner: 'https://padelpit.halbooking.dk/newlook/proc_baner.asp',
    omraede: '1',
  },
  padelpit_karlslunde_halbooking: {
    procBaner: 'https://padelpit.halbooking.dk/newlook/proc_baner.asp',
    omraede: '2',
  },
  oebg_silkeborg_halbooking: {
    procBaner: 'https://oebgtennis.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  padel_lounge_herning: {
    procBaner: 'https://padellounge.halbooking.dk/newlook/proc_baner.asp',
    omraede: '2',
  },
  koge_tennis_halbooking: {
    procBaner: 'https://koge-tennis.halbooking.dk/newlook/proc_baner.asp',
    omraede: '5',
  },
  at_tennis_alleroed: {
    procBaner: 'https://at-tennis.halbooking.dk/newlook/proc_baner.asp',
    omraede: '7',
  },
  tisvilde_tennis_halbooking: {
    procBaner: 'https://tisvildetennis.halbooking.dk/newlook/proc_baner.asp',
    omraede: '2',
  },
  htpk_hillerod_halbooking: {
    procBaner: 'https://htpk.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  match_padel_ballerup: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '6',
  },
  match_padel_ballerup_single: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '7',
  },
  match_padel_naestved: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '15',
  },
  match_padel_nykobing_falster: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '9',
  },
};

export function getAllowlistedVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return HALBOOKING_VENUE_ALLOWLIST[venueId] || null;
}
