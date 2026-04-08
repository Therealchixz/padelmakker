/**
 * Eksterne booking-links (fx klubbens Halbooking) — åbnes i ny fane.
 * Kan sættes pr. bane med kolonnen `booking_url` på `courts`, ellers matches NTSC på navn/adresse.
 */
export const NTSC_HALBOOKING_URL =
  'https://ntsc.halbooking.dk/newlook/proc_baner.asp';

/**
 * @param {Record<string, unknown> | null | undefined} court — række fra `courts`
 * @returns {string | null}
 */
export function externalBookingUrlForCourt(court) {
  if (!court) return null;
  const direct = court.booking_url;
  if (direct != null && String(direct).trim() !== '') {
    return String(direct).trim();
  }
  const hay = `${court.name ?? ''} ${court.address ?? ''}`.toLowerCase();
  if (hay.includes('ntsc')) {
    return NTSC_HALBOOKING_URL;
  }
  return null;
}
