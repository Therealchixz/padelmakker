/** Produktions-URL til canonical, sitemap og Open Graph (kan overskrives med VITE_SITE_URL). */
export const SITE_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL?.trim()) ||
  'https://www.padelmakker.dk'

export function absoluteUrl(pathname) {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${SITE_ORIGIN.replace(/\/$/, '')}${p}`
}
