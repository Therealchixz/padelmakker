/**
 * Eksterne booking-links (fx klubbens Halbooking) — åbnes i ny fane.
 * Kan sættes pr. bane med kolonnen `booking_url` på `courts`, ellers matches på navn/adresse.
 *
 * Skansen Padel (Nørresundby) bruger samme Halbooking som NTSC — ofte står banen som
 * "Skansen Padel" uden "ntsc" i teksten, derfor også match på "skansen".
 */
export const NTSC_HALBOOKING_URL =
  'https://ntsc.halbooking.dk/newlook/proc_baner.asp';

/** Nøgleord i navn/adresse → samme Halbooking-URL som NTSC/Skansen. */
const HALBOOKING_NTSC_KEYWORDS = ['ntsc', 'skansen'];

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
  if (HALBOOKING_NTSC_KEYWORDS.some((k) => hay.includes(k))) {
    return NTSC_HALBOOKING_URL;
  }
  return null;
}
