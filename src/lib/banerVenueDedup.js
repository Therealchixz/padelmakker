/**
 * Undgå dobbeltvisning: Padellife-link med samme navn som integreret center.
 * @param {string} title
 */
export function normalizeVenueTitleKey(title) {
  return String(title || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*—\s*padel\s*\(halbooking\)\s*/gi, ' ')
    .replace(/padel\s+ground/gi, 'padelground')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {{ title: string }[]} integrated
 * @param {{ title: string }[]} links
 */
export function filterLinkVenuesWithoutIntegratedDuplicates(integrated, links) {
  const keys = new Set(integrated.map((v) => normalizeVenueTitleKey(v.title)));
  return links.filter((link) => !keys.has(normalizeVenueTitleKey(link.title)));
}
