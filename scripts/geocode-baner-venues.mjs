/**
 * Geokodér alle baner-centre via Nominatim (OSM) og skriv banerVenuesCoords.generated.js
 * Kør: node scripts/geocode-baner-venues.mjs            (kun centre uden placering)
 *      node scripts/geocode-baner-venues.mjs --retry-approx
 *        (prøv igen for centre, som tjekket markerede som "kun byens midte" eller forkert by)
 * Haandplukkede placeringer (fra centrenes egne sider): scripts/data/baner-venue-locations.json
 * Kør bagefter altid: npm run baner:geo-audit
 * Respekterer 1 req/sek (Nominatim fair use). Cache i scripts/output/baner-venue-coords.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANER_VENUES } from '../src/lib/banerVenues.js';
import { BANER_VENUE_COORDS } from '../src/lib/banerVenuesCoords.generated.js';
import { BANER_VENUE_COORDS_QUALITY } from '../src/lib/banerVenuesCoordsQuality.generated.js';
import { parseVenueAddress } from './audit-baner-venue-coords.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, 'output', 'baner-venue-coords.json');
const OUT_PATH = join(__dirname, '..', 'src', 'lib', 'banerVenuesCoords.generated.js');
const LOCATIONS_PATH = join(__dirname, 'data', 'baner-venue-locations.json');
const USER_AGENT = 'PadelMakker/1.0 (baner geocode; https://padelmakker.dk)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadCache() {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * @param {string} query
 * @param {{ allowTown?: boolean }} [opts]  allowTown=false: afvis træf, der kun er en by/et område
 *   (så et navnesøg på centret ikke ender i byens midte).
 */
async function nominatimSearch(query, opts = {}) {
  const { allowTown = true } = opts;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '3');
  url.searchParams.set('countrycodes', 'dk');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = await res.json();
  const hit = (rows || []).find((r) => allowTown || !isAreaHit(r));
  if (!hit?.lat || !hit?.lon) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    town: isAreaHit(hit),
    postcode: postcodeOf(hit),
    // Navnet paa stedet, Nominatim fandt (bruges af tjekket til at se, om det er selve centret).
    label: String(hit.name || String(hit.display_name || '').split(',')[0] || '').trim(),
  };
}

/**
 * Et traef, der kun er en by eller et omraade. Danske husnumre kommer som category "place",
 * type "house" (place_rank 30), saa de taeller ikke som by.
 * @param {{ category?: string, place_rank?: number }} row
 */
function isAreaHit(row) {
  return ['place', 'boundary'].includes(String(row.category)) && Number(row.place_rank || 0) < 26;
}

/** Postnummeret i Nominatims svar ("..., Region Nordjylland, 9600, Danmark"). */
function postcodeOf(row) {
  const m = String(row.display_name || '').match(/,\s*(\d{4}),\s*Danmark\s*$/);
  return m ? m[1] : null;
}

/** @param {{ title?: string, address?: string, region?: string }} venue */
function venueGeocodeQueries(venue) {
  const address = String(venue.address || '').trim();
  const title = String(venue.title || '').trim();
  const region = String(venue.region || '').trim();
  // Byen i adressen ("Sportsvej 5, 9480, Løkken" -> "Løkken"), ikke gaden.
  // Den gamle udgave brugte foerste del (gaden), og ramte saa en anden by med samme gadenavn.
  const parsed = parseVenueAddress(address);
  const cityHint = parsed.city || (parsed.noStreet ? address.split('—')[0].split(',')[0].trim() : '');
  const looksLikeStreet = /\d/.test(address) && !/se booking/i.test(address);

  const cleanTitle = title.replace(/\s*\((MATCHi|Playtomic|Halbooking|Bookli)\)\s*$/i, '').trim();

  /** @type {{ q: string, allowTown: boolean, via: 'address' | 'name' | 'town' }[]} */
  const queries = [];
  // Praecise forsoeg foerst: gadeadresse, saa centrets navn (kun hvis Nominatim finder selve stedet).
  if (looksLikeStreet) queries.push({ q: `${address.replace(/\s+,/g, ',')}, Denmark`, allowTown: false, via: 'address' });
  if (cleanTitle && cityHint && cityHint.length > 2) queries.push({ q: `${cleanTitle}, ${cityHint}`, allowTown: false, via: 'name' });
  if (cleanTitle) queries.push({ q: cleanTitle, allowTown: false, via: 'name' });
  // Til sidst byens midte (tjekket markerer dem, saa kortet ikke viser en pind).
  if (cityHint && cityHint.length > 2) queries.push({ q: `${cityHint}, ${region}, Denmark`, allowTown: true, via: 'town' });
  if (cityHint && cityHint.length > 2) queries.push({ q: `${cityHint}, Denmark`, allowTown: true, via: 'town' });
  const seen = new Set();
  return queries.filter(({ q }) => (seen.has(q) ? false : (seen.add(q), true)));
}

async function geocodeVenue(venue) {
  const queries = venueGeocodeQueries(venue);
  for (const { q, allowTown, via } of queries) {
    // Gadeadresse: samme opslag som de haandplukkede (fritekst, saa gade + postnummer; postnummeret skal passe).
    const hit = via === 'address'
      ? await geocodeStreetAddress(String(venue.address).replace(/\s+,/g, ','))
      : await nominatimSearch(q, { allowTown });
    if (hit) return { ...hit, via };
    await sleep(1100);
  }
  return null;
}

function renderGenerated(coordsById) {
  const lines = [
    '/** Auto-generated — kør: node scripts/geocode-baner-venues.mjs */',
    '/** @type {Record<string, { lat: number, lng: number }>} */',
    'export const BANER_VENUE_COORDS = {',
  ];
  for (const [id, c] of Object.entries(coordsById).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${JSON.stringify(id)}: { lat: ${c.lat}, lng: ${c.lng} },`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

/**
 * Haandplukkede placeringer fra centrenes egne sider (scripts/data/baner-venue-locations.json):
 * enten faste koordinater (fx fra MATCHi eller et kort paa klubbens side) eller en gadeadresse.
 * @returns {Promise<Record<string, { lat?: number, lng?: number, address?: string, source: string }>>}
 */
async function loadLocations() {
  try {
    return JSON.parse(await readFile(LOCATIONS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Gadeadresse -> punkt. Proever fritekst og saa felt-for-felt (gade + postnummer).
 * Svaret skal have samme postnummer som adressen (ellers kan "Århusvej 19" ende i en anden by).
 */
async function geocodeStreetAddress(address) {
  const m = address.match(/^(.+?),\s*(\d{4})\b/);
  const postal = m?.[2];
  const hit = await nominatimSearch(`${address}, Denmark`, { allowTown: false });
  if (hit && (!postal || hit.postcode === postal)) return hit;
  await sleep(1100);
  if (!m) return null;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('street', m[1]);
  url.searchParams.set('postalcode', m[2]);
  url.searchParams.set('country', 'Denmark');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [row] = await res.json();
  if (!row?.lat || isAreaHit(row) || postcodeOf(row) !== postal) return null;
  return { lat: Number(row.lat), lng: Number(row.lon), town: false, label: String(row.name || ''), postcode: postal };
}

async function main() {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  const cache = await loadCache();
  // Cachen kan mangle (fx ny maskine): start fra den genererede fil.
  for (const [id, c] of Object.entries(BANER_VENUE_COORDS)) if (!cache[id]) cache[id] = { lat: c.lat, lng: c.lng };
  /** Gamle punkter for centre, vi proever igen. Bruges, hvis det nye forsoeg ikke finder noget. */
  const previous = {};
  if (process.argv.includes('--retry-approx')) {
    for (const id of Object.keys(BANER_VENUE_COORDS_QUALITY)) {
      if (cache[id]) previous[id] = cache[id];
      delete cache[id];
    }
    console.log(`Prøver ${Object.keys(BANER_VENUE_COORDS_QUALITY).length} upræcise centre igen.`);
  }
  let fetched = 0;
  let failed = 0;

  // Haandplukkede placeringer foerst. srcKey: slaa kun op igen, naar posten i filen er aendret.
  const locations = await loadLocations();
  const knownIds = new Set(BANER_VENUES.map((v) => v.id));
  for (const [id, loc] of Object.entries(locations)) {
    if (!knownIds.has(id)) {
      console.warn('ukendt center i baner-venue-locations.json:', id);
      continue;
    }
    const srcKey = JSON.stringify(loc);
    if (cache[id]?.srcKey === srcKey) continue;
    if (loc.lat != null && loc.lng != null) {
      cache[id] = { lat: loc.lat, lng: loc.lng, via: 'source', source: loc.source, srcKey };
      continue;
    }
    if (!loc.address) continue;
    process.stdout.write(`adresse ${id} (${loc.address})… `);
    try {
      const hit = await geocodeStreetAddress(loc.address);
      if (hit) {
        cache[id] = { lat: hit.lat, lng: hit.lng, via: 'source', label: hit.label, source: loc.source, srcKey };
        fetched += 1;
        console.log(`${hit.lat}, ${hit.lng}`);
      } else {
        console.log('ingen træf (beholder det gamle punkt)');
        failed += 1;
      }
    } catch (err) {
      console.log('fejl:', err.message);
      failed += 1;
    }
    if (!cache[id] && previous[id]) cache[id] = previous[id];
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
    await sleep(1100);
  }

  for (const v of BANER_VENUES) {
    if (cache[v.id]?.lat != null && cache[v.id]?.lng != null) continue;
    const address = String(v.address || '').trim();
    if (!address) {
      console.warn('skip (no address):', v.id);
      failed += 1;
      continue;
    }
    process.stdout.write(`geocode ${v.id}… `);
    try {
      const hit = await geocodeVenue(v);
      if (hit) {
        cache[v.id] = hit;
        fetched += 1;
        console.log(`${hit.lat}, ${hit.lng}`);
      } else {
        console.log('ingen træf');
        failed += 1;
      }
    } catch (err) {
      console.log('fejl:', err.message);
      failed += 1;
    }
    // Intet nyt traef: behold det gamle (upraecise) punkt, saa centret ikke forsvinder fra kortet.
    if (!cache[v.id] && previous[v.id]) cache[v.id] = previous[v.id];
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
    // Pause ogsaa efter et traef, saa naeste center ikke spoerger med det samme (1 req/sek).
    await sleep(1100);
  }

  await writeFile(OUT_PATH, renderGenerated(cache));
  const withCoords = Object.keys(cache).length;
  console.log(`\nFærdig: ${withCoords}/${BANER_VENUES.length} med koordinater (${fetched} nye, ${failed} uden træf denne kørsel).`);
  console.log('Kør nu: npm run baner:geo-audit');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
