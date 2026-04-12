/**
 * Kun disse venue-id må bruges mod Halbooking (sikkerhed).
 * Tilføj flere Nordjylland-/DK-baner her + samme halbooking-id i src/lib/banerVenues.js
 */

export const HALBOOKING_VENUE_ALLOWLIST = {
  skansen_ntsc: {
    procBaner: 'https://ntsc.halbooking.dk/newlook/proc_baner.asp',
    omraede: '5',
  },
  /** Poul Larsens vej 36, Aalborg */
  padel_lounge_aalborg: {
    procBaner: 'https://padellounge.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  /** Match Padel — justér omraede i Supabase hvis padel ligger under andet id i Halbooking */
  match_padel_halbooking: {
    procBaner: 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp',
    omraede: '5',
  },
  /** HimmerLand — Padel = område 3 i Halbooking-dropdown */
  himmerland_halbooking: {
    procBaner: 'https://himmerland.halbooking.dk/newlook/proc_baner.asp',
    omraede: '3',
  },
  /** Sportshallen Frederikshavn — Padel = område 2 (standardvalg på proc_baner) */
  sportshallen_frederikshavn_halbooking: {
    procBaner: 'https://sportshallen.halbooking.dk/newlook/proc_baner.asp',
    omraede: '2',
  },
};

export function getAllowlistedVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return HALBOOKING_VENUE_ALLOWLIST[venueId] || null;
}
