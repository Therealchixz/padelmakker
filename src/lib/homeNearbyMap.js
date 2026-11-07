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
  const nextByTitle = new Map();
  for (const m of openMatches || []) {
    const key = normalizeVenueName(m?.court || '');
    if (!key) continue;
    countByTitle.set(key, (countByTitle.get(key) || 0) + 1);
    const when = `${m?.date || ''} ${m?.time || ''}`.trim();
    if (when && (!nextByTitle.has(key) || when < nextByTitle.get(key).when)) {
      nextByTitle.set(key, { when, date: m.date || null, time: m.time || null });
    }
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
      // Kun byens midte (eller rettet til den rigtige by): ingen pind paa kortet, "ca." foran afstanden.
      approx: Boolean(v.coordsApprox),
      indoor: typeof v.indoor === 'boolean' ? v.indoor : null,
      matchCount: countByTitle.get(key) || 0,
      nextMatch: nextByTitle.get(key) || null,
    });
  }
  rows.sort((a, b) => (b.matchCount > 0) - (a.matchCount > 0) || a.km - b.km);
  return rows.slice(0, limit);
}

/** Kort tekst om afstand, fx "2 km" eller "under 1 km". Med approx: "ca. 2 km". */
export function formatNearbyKm(km, approx = false) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return approx ? 'ca. 1 km' : 'under 1 km';
  return `${approx ? 'ca. ' : ''}${Math.round(km)} km`;
}

const DAYS_SHORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

/**
 * Linjen under centrets navn paa kortet, i prototypens stil:
 * "2 åbne · næste fre 18:00" eller "Ingen åbne kampe · 2 km".
 * @param {{ matchCount: number, nextMatch?: { date?: string|null, time?: string|null } | null, km: number, approx?: boolean, indoor?: boolean|null }} v
 * @param {'kampe'|'baner'} mode
 * @param {Date} [now]
 */
export function nearbyVenueMeta(v, mode, now = new Date()) {
  const dist = formatNearbyKm(v.km, v.approx);
  if (mode === 'baner') {
    const kind = v.indoor === true ? 'indendørs' : v.indoor === false ? 'udendørs' : '';
    return [dist, kind].filter(Boolean).join(' · ');
  }
  if (!v.matchCount) return `Ingen åbne kampe · ${dist}`;
  const parts = [`${v.matchCount} ${v.matchCount === 1 ? 'åben' : 'åbne'}`];
  const n = v.nextMatch;
  if (n?.date) {
    const d = new Date(`${String(n.date).slice(0, 10)}T00:00:00`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((d - today) / 86400000);
    const day = diff === 0 ? 'i dag' : diff === 1 ? 'i morgen' : DAYS_SHORT[d.getDay()];
    const time = n.time ? String(n.time).slice(0, 5) : '';
    parts.push(`næste ${day}${time ? ` ${time}` : ''}`);
  }
  parts.push(dist);
  return parts.join(' · ');
}
