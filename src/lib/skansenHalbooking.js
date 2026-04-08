/**
 * Skansen Padel bookes via NTSC Halbooking (område-id 5 = Padel, Lerumbakken 11).
 * Live ledige tider hentes via `/api/halbooking-skansen-padel` (Vercel).
 */
export const SKANSEN_PADEL_HALBOOKING_URL =
  'https://ntsc.halbooking.dk/newlook/proc_baner.asp?soeg_omraede=5';

/**
 * @param {string} courtName
 * @param {string} time HH:MM
 */
export function skansenBookingHintUrl(courtName, time) {
  const q = new URLSearchParams();
  q.set('pm_bane', courtName);
  q.set('pm_tid', time);
  return `${SKANSEN_PADEL_HALBOOKING_URL}&${q.toString()}`;
}
