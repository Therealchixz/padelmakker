/**
 * Skansen Padel bookes via NTSC Halbooking (område-id 5 = Padel, Lerumbakken 11).
 * Live ledige tider: GET `/api/halbooking-skansen-padel`
 *
 * Direkte link til Halbooking med Padel valgt: vores side auto-POST'er (GET ?soeg_omraede=5 virker ikke).
 */
export const SKANSEN_PADEL_HALBOOKING_ENTRY = '/api/halbooking-open-padel';

/** @deprecated Brug SKANSEN_PADEL_HALBOOKING_ENTRY — beholdt hvis noget importerer navnet. */
export const SKANSEN_PADEL_HALBOOKING_URL = SKANSEN_PADEL_HALBOOKING_ENTRY;

/**
 * @param {string} courtName
 * @param {string} time HH:MM
 */
export function skansenBookingHintUrl(courtName, time) {
  const q = new URLSearchParams();
  q.set('pm_bane', courtName);
  q.set('pm_tid', time);
  return `${SKANSEN_PADEL_HALBOOKING_ENTRY}?${q.toString()}`;
}
