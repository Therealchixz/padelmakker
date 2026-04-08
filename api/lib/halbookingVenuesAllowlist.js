/**
 * Kun disse venue-id må bruges mod Halbooking (sikkerhed).
 * Tilføj flere Nordjylland-/DK-baner her + samme id i src/lib/halbookingVenues.js
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
};

export function getAllowlistedVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return HALBOOKING_VENUE_ALLOWLIST[venueId] || null;
}
