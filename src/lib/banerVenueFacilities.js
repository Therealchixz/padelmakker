/**
 * Kuraterede faciliteter for Baner-centre (samme nøgler som courtFacilities.jsx / kampe-filter).
 * Kun verificerede hits — udvid batchvist efter review af klub-/MATCHi-beskrivelser.
 */

/** @type {Record<string, string[]>} */
export const BANER_VENUE_FACILITIES = {
  // Halbooking / DB-synk (courts.facilities)
  skansen_ntsc: ['parking', 'changing_rooms', 'showers', 'cafe', 'pro_shop', 'wifi'],

  // Bookli / kæde — padelpadel.dk centre + FAQ
  padelpadel_aalborg: ['parking', 'changing_rooms', 'showers', 'pro_shop', 'equipment_rental'],

  // MATCHi — facility-desc (manuel kontekst-check 2026-07-29)
  matchi_padelnord: ['changing_rooms', 'cafe'],
  matchi_padel8500: ['parking', 'changing_rooms', 'showers', 'cafe', 'equipment_rental'],
  matchi_padelland: ['parking', 'changing_rooms', 'equipment_rental'],
  matchi_vipadelaarhus: ['parking', 'changing_rooms', 'cafe', 'equipment_rental'],
};

/**
 * @param {{ id: string, facilities?: string[] }} venue
 * @returns {typeof venue & { facilities?: string[] }}
 */
export function attachVenueFacilities(venue) {
  const curated = BANER_VENUE_FACILITIES[venue.id];
  if (!curated?.length) return venue;
  return { ...venue, facilities: curated };
}
