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
    assumePadel: true,
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
    assumePadel: true,
  },
  match_padel_naestved: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '15',
  },
  match_padel_nykobing_falster: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '9',
  },
  match_padel_gudhjem: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '17',
  },
  match_padel_svaneke: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '18',
  },
  atk_arbejdernes_tennisklub_halbooking: {
    procBaner: 'https://atk.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  struer_energi_park_halbooking: {
    procBaner: 'https://struerhallerne.halbooking.dk/newlook/proc_baner.asp',
    omraede: '19',
  },
  bjerringbro_padel_halbooking: {
    procBaner: 'https://bjerringbroip.halbooking.dk/newlook/proc_baner.asp',
    omraede: '10',
  },
  oksbol_padel_halbooking: {
    procBaner: 'https://blaavandshuk.halbooking.dk/newlook/proc_baner.asp',
    omraede: '28',
  },
  padel_lounge_aarhus_halbooking: {
    procBaner: 'https://padellounge.halbooking.dk/newlook/proc_baner.asp',
    omraede: '4',
  },
  padel_lounge_odense: {
    procBaner: 'https://padellounge.halbooking.dk/newlook/proc_baner.asp',
    omraede: '5',
  },
  padel_zone_holstebro_halbooking: {
    procBaner: 'https://padelzone.halbooking.dk/newlook/proc_baner.asp',
    omraede: '1',
  },
  smash_horsens_double: {
    procBaner: 'https://smash.halbooking.dk/newlook/proc_baner.asp',
    omraede: '1',
    assumePadel: true,
  },
  smash_horsens_single: {
    procBaner: 'https://smash.halbooking.dk/newlook/proc_baner.asp',
    omraede: '5',
    assumePadel: true,
  },
  smash_stensballe: {
    procBaner: 'https://smash.halbooking.dk/newlook/proc_baner.asp',
    omraede: '6',
    assumePadel: true,
  },
  match_padel_studio_kbh: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '20',
  },
  match_padel_klovermarken: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '3',
  },
  match_padel_silkeborg_syd: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '4',
  },
  match_padel_bornholm_inde: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '13',
  },
  match_padel_bornholm_ude_ronne: {
    procBaner: MATCH_PADEL_PROC,
    omraede: '10',
  },
  lezgo_padel_lasby: {
    procBaner: 'https://lezgopadel.halbooking.dk/newlook/proc_baner.asp',
    omraede: '',
  },
  lets_padel_hillerod: {
    procBaner: 'https://letspadel.halbooking.dk/newlook/proc_baner.asp',
    omraede: '',
  },
};

export function getAllowlistedVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return HALBOOKING_VENUE_ALLOWLIST[venueId] || null;
}
