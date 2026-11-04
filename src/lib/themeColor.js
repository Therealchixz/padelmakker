/**
 * Farven paa telefonens statusbjaelke og browserens top (meta theme-color).
 * Skal matche det oeverste paa siden, ellers ser appen ud som en hjemmeside (skill: mobile-native).
 */
export const THEME_COLOR_LIGHT = '#F3EEE4';
export const THEME_COLOR_DARK = '#141311';
export const THEME_COLOR_INK = '#1B1A17';

/** @param {string} color */
export function setThemeColor(color) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

/** Statusbjaelken efter lys/moerk tilstand, som den er sat paa <html>. */
export function syncThemeColorWithTheme() {
  if (typeof document === 'undefined') return;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  setThemeColor(dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}
