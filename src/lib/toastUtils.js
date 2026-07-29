/**
 * Toast helpers: type-inference + normalisering for showToast(msg, type?).
 * @typedef {'success' | 'error' | 'info'} ToastType
 */

const ERROR_RE =
  /kunne ikke|mislykkedes|fejl[:\s]|fejl$|ikke tilladt|ikke fundet|prøv igen|kan ikke |må ikke|ugyldig|mangler |kræver |blokering/i;

const SUCCESS_RE =
  /gemt|sendt|tilmeldt|opdateret|godkendt|afmeldt|startet|slettet|registreret|accepteret|oprettet|fjernet|kopieret|stoppet|åbnet|hentet|synces|synkroniseret|flyttet|skiftet|skrevet på|invitation sendt|adgangskode|tak!|afvist/i;

/**
 * @param {unknown} message
 * @returns {ToastType}
 */
export function inferToastType(message) {
  const text = String(message || '').trim();
  if (!text) return 'info';
  if (ERROR_RE.test(text)) return 'error';
  if (SUCCESS_RE.test(text)) return 'success';
  return 'info';
}

/**
 * @param {unknown} type
 * @param {unknown} message
 * @returns {ToastType}
 */
export function resolveToastType(type, message) {
  if (type === 'success' || type === 'error' || type === 'info') return type;
  return inferToastType(message);
}

/**
 * @param {ToastType} type
 * @returns {number}
 */
export function toastDurationMs(type) {
  if (type === 'error') return 4500;
  if (type === 'success') return 3200;
  return 3000;
}
