/**
 * Tilladte Bookli-lokationer (offentlig timeline / samme data som PadelPadel iframe).
 * categoryId kan udlæses én gang via resourceCategories — her cachet for Aalborg.
 */

export const BOOKLI_VENUE_ALLOWLIST = {
  padelpadel_aalborg: {
    locationId: 'ckup3fdqf6267601da5gxm9a0yj',
    /** Kategori "Padel" — filtrerer mødelokale ud af resource-listen */
    resourceCategoryId: 'ckup3puay6369731da52u9khirj',
    timezone: 'Europe/Copenhagen',
  },
  padelclub_roskilde_bookli: {
    locationId: 'ckt1o3a2u11617261da07ieg2nmc',
    resourceCategoryId: 'ckt1o3vwt10174391d8qfbpq32s0',
    timezone: 'Europe/Copenhagen',
  },
  padelclub_koge_bookli: {
    locationId: 'cl6kkzj108249110ds68hhwggm8',
    resourceCategoryId: 'cl6kl6i1w8691970ds6ojdztv6t',
    timezone: 'Europe/Copenhagen',
  },
};

export function getBookliVenue(venueId) {
  if (!venueId || typeof venueId !== 'string') return null;
  return BOOKLI_VENUE_ALLOWLIST[venueId] || null;
}
