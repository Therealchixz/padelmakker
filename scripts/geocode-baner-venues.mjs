/**
 * Geokodér alle baner-centre via Nominatim (OSM) og skriv banerVenuesCoords.generated.js
 * Kør: node scripts/geocode-baner-venues.mjs
 * Respekterer 1 req/sek (Nominatim fair use). Cache i scripts/output/baner-venue-coords.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANER_VENUES } from '../src/lib/banerVenues.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, 'output', 'baner-venue-coords.json');
const OUT_PATH = join(__dirname, '..', 'src', 'lib', 'banerVenuesCoords.generated.js');
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

async function nominatimSearch(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'dk');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = await res.json();
  const hit = rows?.[0];
  if (!hit?.lat || !hit?.lon) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

/** @param {{ title?: string, address?: string, region?: string }} venue */
function venueGeocodeQueries(venue) {
  const address = String(venue.address || '').trim();
  const title = String(venue.title || '').trim();
  const region = String(venue.region || '').trim();
  const cityHint = address.split('—')[0].split(',')[0].trim();
  const looksLikeStreet = /\d/.test(address) && !/se booking/i.test(address);

  /** @type {string[]} */
  const queries = [];
  if (looksLikeStreet) queries.push(`${address}, Denmark`);
  if (title && cityHint && cityHint.length > 2) queries.push(`${title}, ${cityHint}, Denmark`);
  if (title && region) queries.push(`${title}, ${region}, Denmark`);
  if (cityHint && region) queries.push(`${cityHint}, ${region}, Denmark`);
  if (cityHint && cityHint.length > 2) queries.push(`${cityHint}, Denmark`);
  return [...new Set(queries)];
}

async function geocodeVenue(venue) {
  const queries = venueGeocodeQueries(venue);
  for (const q of queries) {
    const hit = await nominatimSearch(q);
    if (hit) return hit;
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

async function main() {
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  const cache = await loadCache();
  let fetched = 0;
  let failed = 0;

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
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
  }

  await writeFile(OUT_PATH, renderGenerated(cache));
  const withCoords = Object.keys(cache).length;
  console.log(`\nFærdig: ${withCoords}/${BANER_VENUES.length} med koordinater (${fetched} nye, ${failed} uden træf denne kørsel).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
