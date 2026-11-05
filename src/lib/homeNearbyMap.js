import { haversineKm, parseGeoCoords } from './geoDistance.js';

/** Samme normalisering som bane-soegningen (smaa bogstaver, uden accenter), plus trim. */
function normalizeVenueName(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Centre taet paa spilleren til kortet paa Hjem, med antal aabne kampe pr. center.
 * Kampe kobles til et center via banens navn (samme navn som i bane-oversigten).
 *
 * @param {Array<{ id: string, title: string, address?: string, latitude?: number, longitude?: number }>} venues
 * @param {{ latitude: number, longitude: number } | null} me
 * @param {Array<{ matchId: string|number, court?: string }>} openMatches
 * @param {{ maxKm?: number, limit?: number }} [opts]
 */
export function buildNearbyVenues(venues, me, openMatches = [], opts = {}) {
  const { maxKm = 30, limit = 12 } = opts;
  if (!me) return [];
  const countByTitle = new Map();
  for (const m of openMatches || []) {
    const key = normalizeVenueName(m?.court || '');
    if (!key) continue;
    countByTitle.set(key, (countByTitle.get(key) || 0) + 1);
  }
  const seen = new Set();
  const rows = [];
  for (const v of venues || []) {
    const c = parseGeoCoords(v?.latitude, v?.longitude);
    if (!c) continue;
    const key = normalizeVenueName(v.title || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const km = haversineKm(me.latitude, me.longitude, c.latitude, c.longitude);
    if (!Number.isFinite(km) || km > maxKm) continue;
    rows.push({
      id: String(v.id),
      title: v.title,
      address: v.address || '',
      latitude: c.latitude,
      longitude: c.longitude,
      km,
      matchCount: countByTitle.get(key) || 0,
    });
  }
  rows.sort((a, b) => (b.matchCount > 0) - (a.matchCount > 0) || a.km - b.km);
  return rows.slice(0, limit);
}

/** Kort tekst om afstand, fx "2 km" eller "under 1 km". */
export function formatNearbyKm(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return 'under 1 km';
  return `${Math.round(km)} km`;
}
