/**
 * Tjek af bane-centrenes placering paa kortet (uden netvaerk).
 *
 * Geokodningen (scripts/geocode-baner-venues.mjs) falder tilbage til byens midte,
 * naar et center ikke har en gadeadresse, og kan ramme en forkert by med samme
 * gadenavn. Dette script finder de pinde og skriver
 * src/lib/banerVenuesCoordsQuality.generated.js:
 *
 *  - "town":     placeringen er kun byens midte (eller deles af flere centre).
 *                Kortet viser ikke en pind, listen skriver "ca." foran afstanden.
 *  - "mismatch": placeringen ligger langt fra postnummeret/byen i adressen.
 *                Pinden flyttes til postnummerets midte og regnes som "town".
 *
 * Koer efter hver geokodning:  npm run baner:geo-audit
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANER_VENUE_COORDS } from '../src/lib/banerVenuesCoords.generated.js';
import { DK_PLACES, DK_POSTAL } from '../src/lib/dkPlacesData.js';
import { haversineKm } from '../src/lib/geoDistance.js';
import { BANER_VENUES_RAW } from '../src/lib/banerVenues.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'lib', 'banerVenuesCoordsQuality.generated.js');

/** Hvor taet paa et bypunkt en pind skal ligge, foer vi regner den for "byens midte". */
const TOWN_CENTER_KM = 0.35;
/** Hvor langt fra byen i adressen en pind maa ligge, foer den regnes for forkert. */
const CITY_MISMATCH_KM = 20;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();

const postalByCode = new Map(DK_POSTAL.map(([code, city, lat, lng]) => [String(code), { city, lat, lng }]));

/** Alle steder med et navn som byen i adressen (ogsaa "Nørre Vorupør" for "Vorupør"). */
function placeCandidates(city) {
  const key = norm(city);
  if (!key || key.length < 3) return [];
  return DK_PLACES
    .filter(([name]) => { const n = norm(name); return n === key || n.endsWith(` ${key}`); })
    .map(([, lat, lng, rank, pop]) => ({ lat, lng, rank, pop: pop || 0 }));
}

/** Grov opdeling i felter, saa vi kan finde naermeste bypunkt hurtigt. */
const grid = new Map();
const cellKey = (lat, lng) => `${Math.round(lat * 20)}:${Math.round(lng * 10)}`;
for (const [, lat, lng] of DK_PLACES) {
  const k = cellKey(lat, lng);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push([lat, lng]);
}
for (const [, , lat, lng] of DK_POSTAL) {
  const k = cellKey(lat, lng);
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push([lat, lng]);
}
function nearestTownPointKm(lat, lng) {
  const la = Math.round(lat * 20);
  const lo = Math.round(lng * 10);
  let best = Infinity;
  for (let a = -1; a <= 1; a += 1) {
    for (let b = -1; b <= 1; b += 1) {
      for (const [plat, plng] of grid.get(`${la + a}:${lo + b}`) || []) {
        const d = haversineKm(lat, lng, plat, plng);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

/** Postnummer og by fra en adresse som "Sportsvej 5, 9480 , Løkken" eller "Nørresundby — se booking-link". */
export function parseVenueAddress(address) {
  const a = String(address || '');
  const postal = (a.match(/\b(\d{4})\b/) || [])[1] || null;
  const noStreet = /se booking/i.test(a) || !/\d/.test(a.split(',')[0] || '');
  let city = '';
  if (/—/.test(a)) city = a.split('—')[0].trim();
  else {
    const parts = a.split(',').map((p) => p.replace(/\b\d{4}\b/g, '').trim()).filter(Boolean);
    city = parts.length > 1 ? parts[parts.length - 1] : '';
  }
  return { postal, city, noStreet };
}

export function auditVenueCoords(venues, coordsById) {
  /** @type {Record<string, { approx: true, reason: string, lat?: number, lng?: number }>} */
  const out = {};
  const sameSpot = new Map();
  for (const v of venues) {
    const c = coordsById[v.id];
    if (!c) continue;
    const k = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
    sameSpot.set(k, (sameSpot.get(k) || 0) + 1);
  }
  for (const v of venues) {
    const c = coordsById[v.id];
    if (!c) continue;
    const { postal, city, noStreet } = parseVenueAddress(v.address);

    // Mulige rigtige steder: byer med navnet fra adressen + postnummerets midte.
    const places = placeCandidates(city);
    const cands = [...places];
    const pc = postal ? postalByCode.get(postal) : null;
    if (pc) cands.push({ lat: pc.lat, lng: pc.lng, rank: 0, pop: 0, postal: true });
    const nearest = cands.reduce((best, p) => {
      const d = haversineKm(c.lat, c.lng, p.lat, p.lng);
      return !best || d < best.d ? { ...p, d } : best;
    }, null);
    const biggest = places.slice().sort((x, y) => y.pop - x.pop)[0] || null;

    // 1) Langt fra alle steder med byens navn: forkert by.
    if (nearest && nearest.d > CITY_MISMATCH_KM) {
      const fix = biggest || (pc ? { lat: pc.lat, lng: pc.lng } : null);
      out[v.id] = { approx: true, reason: `mismatch ${Math.round(nearest.d)} km fra ${city || postal}`, ...(fix ? { lat: fix.lat, lng: fix.lng } : {}) };
      continue;
    }
    // 2) Ramte en lille landsby, naar der findes en meget stoerre by med samme navn
    //    (Lynge ved Sorø i stedet for Lynge i Nordsjælland, Ullerslev paa Lolland i stedet for Fyn).
    if (nearest && !nearest.postal && biggest && biggest !== nearest
        && biggest.pop >= 1000 && biggest.pop >= 5 * (nearest.pop || 0)
        && haversineKm(nearest.lat, nearest.lng, biggest.lat, biggest.lng) > 5) {
      out[v.id] = { approx: true, reason: `mismatch: lille ${city} i stedet for den store`, lat: biggest.lat, lng: biggest.lng };
      continue;
    }
    const shared = sameSpot.get(`${c.lat.toFixed(5)},${c.lng.toFixed(5)}`) > 1;
    const atTownPoint = nearestTownPointKm(c.lat, c.lng) <= TOWN_CENTER_KM;
    if (noStreet && (atTownPoint || shared)) out[v.id] = { approx: true, reason: 'town (ingen gadeadresse)' };
    else if (shared) out[v.id] = { approx: true, reason: 'town (samme punkt som andre centre)' };
    else if (noStreet && !cands.length) out[v.id] = { approx: true, reason: 'town (ingen adresse at tjekke mod)' };
  }
  return out;
}

function render(quality) {
  const lines = [
    '/** Auto-generated — kør: npm run baner:geo-audit (scripts/audit-baner-venue-coords.mjs) */',
    '/** Centre, hvis placering kun er byens midte eller var forkert. approx = ingen pind på kortet. */',
    '/** @type {Record<string, { approx: true, reason: string, lat?: number, lng?: number }>} */',
    'export const BANER_VENUE_COORDS_QUALITY = {',
  ];
  for (const [id, q] of Object.entries(quality).sort(([a], [b]) => a.localeCompare(b))) {
    const fix = q.lat != null ? `, lat: ${q.lat}, lng: ${q.lng}` : '';
    lines.push(`  ${JSON.stringify(id)}: { approx: true, reason: ${JSON.stringify(q.reason)}${fix} },`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const quality = auditVenueCoords(BANER_VENUES_RAW, BANER_VENUE_COORDS);
  await writeFile(OUT_PATH, render(quality));
  const counts = {};
  for (const q of Object.values(quality)) {
    const k = q.reason.split(/[ :]/)[0];
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log(`Tjekket ${BANER_VENUES_RAW.length} centre. Upraecise: ${Object.keys(quality).length}`, counts);
  for (const [id, q] of Object.entries(quality)) if (q.reason.startsWith('mismatch')) console.log('  ', id, '→', q.reason);
}
