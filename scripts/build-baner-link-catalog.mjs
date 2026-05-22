/**
 * Byg link-venues fra Padellife-oversigt (markdown med [Navn](url)).
 * Kør: node scripts/build-baner-link-catalog.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guessJutlandRegionFromPlace } from '../src/lib/banerRegions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC =
  process.argv[2] ||
  join(__dirname, '..', 'scripts', 'data', 'padellife-baner-oversigt.md');
const OUT = join(__dirname, '..', 'src', 'lib', 'banerVenuesLinks.generated.js');

/** @type {Record<string, string>} */
const SECTION_REGION = {
  'padelbaner i københavn': 'Hovedstaden',
  'padelbaner på sjælland': 'Sjælland',
  'padelbaner på fyn og langeland': 'Fyn',
  'padelbaner på fyn': 'Fyn',
  'padelbaner i sydjylland': 'Sønderjylland',
  'padelbaner i midtjylland': '__MIDT__',
  'padelbaner i nordjylland': 'Nordjylland',
  'padelbaner på bornholm': 'Bornholm',
};

/** Allerede fuldt integreret — undgå duplikat-link */
const INTEGRATED_URL_FRAGMENTS = [
  'matchi.se',
  'halbooking.dk/newlook/proc_baner',
  'bookli.app',
  'padel8500',
  'padelnord',
  'padel99',
  'SkagenPadelcenter',
  'breinhotlgardpadel',
  'k7-padel',
  'NrLyndelsePadeltennis',
  'padelyard',
  'Padel4alle',
  'padelnorth',
  'vipadelslagelse',
  'Padelland',
  'ViPadelAarhus',
  'padelmaster.halbooking',
  'xpadel.halbooking',
  'padelpit.halbooking',
  'oebgtennis.halbooking',
  'padellounge.halbooking',
  'ntsc.halbooking',
  'himmerland.halbooking',
  'sportshallen.halbooking',
];

function slugify(...parts) {
  return parts
    .join('_')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 72);
}

/** Match Padel-afdelinger med Halbooking i appen */
const MATCH_PADEL_IN_APP = [
  '/aalborg',
  '/aarhus',
  '/odense',
  '/silkeborg',
  '/lemvig',
  '/hobro',
  '/ballerup',
  '/klovermarken',
  '/studio',
  '/naestved',
  '/nykobing',
  '/nykobing-falster',
];

const INTEGRATED_URL_FRAGMENTS_EXTRA = [
  'htpk.halbooking.dk',
  'hitk.halbooking.dk',
  'at-tennis.halbooking.dk',
  'koge-tennis.halbooking.dk',
  'tisvildetennis.halbooking.dk',
  'xpadel.halbooking.dk',
  'padelpit.halbooking.dk',
  'RacketClubTaastrup',
  'vipadelslagelse',
  'Padel4alle',
  'padelnorth',
];

function isIntegratedUrl(url, title = '') {
  const u = url.toLowerCase();
  if (u.includes('matchpadel.dk/afdelinger')) {
    if (MATCH_PADEL_IN_APP.some((p) => u.includes(p))) return true;
    return false;
  }
  return [...INTEGRATED_URL_FRAGMENTS, ...INTEGRATED_URL_FRAGMENTS_EXTRA].some((f) =>
    u.includes(f.toLowerCase())
  );
}

let md;
try {
  md = await readFile(SRC, 'utf8');
} catch {
  console.error('Missing source markdown:', SRC);
  console.error('Save Padellife article to scripts/data/padellife-baner-oversigt.md');
  process.exit(1);
}

/** @type {string | null} */
let currentSection = null;
/** @type {Map<string, object>} */
const byId = new Map();

const lineRe = /^([^:\n]+):\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/;

for (const line of md.split(/\r?\n/)) {
  const h2 = line.match(/^##\s+(.+)/);
  if (h2) {
    const key = h2[1].trim().toLowerCase();
    if (key.startsWith('padelbaner ')) {
      currentSection = SECTION_REGION[key] ?? currentSection;
    }
    continue;
  }
  const h3 = line.match(/^###\s+Padelbaner i (.+)/i);
  if (h3) {
    const key = `padelbaner i ${h3[1].trim().toLowerCase()}`;
    currentSection = SECTION_REGION[key] ?? currentSection;
    continue;
  }

  const m = line.match(lineRe);
  if (!m || !currentSection) continue;

  const city = m[1].trim();
  const title = m[2].trim();
  const bookingUrl = m[3].trim();
  if (!title || title === 'All-Padel' || isIntegratedUrl(bookingUrl, title)) continue;

  let region = currentSection;
  if (region === '__MIDT__') {
    region = guessJutlandRegionFromPlace(`${city} ${title}`);
  }

  const id = `link_${slugify(city, title)}`;
  if (byId.has(id)) continue;

  byId.set(id, {
    kind: 'link',
    id,
    title,
    address: `${city} — se booking-link`,
    indoor: true,
    region,
    bookingUrl,
    note: 'Fra Padellife-oversigten. Ledige tider vises på centrets side — PadelMakker henter dem ikke inline.',
  });
}

const venues = [...byId.values()].sort((a, b) =>
  a.region.localeCompare(b.region, 'da') || a.title.localeCompare(b.title, 'da')
);

const js = `/** Auto-genereret — kør: node scripts/build-baner-link-catalog.mjs */
/** @type {import('./banerVenues.js').BanerVenue[]} */
export const BANER_VENUES_LINKS = ${JSON.stringify(venues, null, 2)};
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, js, 'utf8');
console.log(`Wrote ${venues.length} link venues to ${OUT}`);
for (const r of ['Nordjylland', 'Vestjylland', 'Østjylland', 'Sønderjylland', 'Fyn', 'Sjælland', 'Hovedstaden', 'Bornholm']) {
  console.log(`  ${r}:`, venues.filter((v) => v.region === r).length);
}
