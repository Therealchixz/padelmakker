/**
 * Byg link-venues fra Padellife-oversigt (markdown med [Navn](url)).
 * Kør: node scripts/build-baner-link-catalog.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guessJutlandRegionFromPlace } from '../src/lib/banerRegions.js';
import { normalizeVenueTitleKey } from '../src/lib/banerVenueDedup.js';

/** Titler på fuldt integrerede centre i banerVenues.js (hold synkron) */
const INTEGRATED_TITLE_KEYS = new Set(
  [
    'Skansen Padel',
    'Padel Lounge Aalborg',
    'Match Padel Aalborg',
    'PadelPadel Aalborg (AL Bank Arena)',
    'HimmerLand padel (Halbooking)',
    'Sæby Spektrum & Hostel (padel)',
    'Sportshallen Frederikshavn — padel (Halbooking)',
    'Match Padel Lemvig',
    'Match Padel Hobro (Sparekassen Danmark Padel)',
    'Padel Nord (MATCHi)',
    'Padel99 (MATCHi)',
    'Skagen Padelcenter (MATCHi)',
    'Padel8500 (MATCHi)',
    'PadelMaster Hadsten (Halbooking)',
    'Match Padel Aarhus',
    'Padel Land (MATCHi)',
    'ViPadel Aarhus (MATCHi)',
    'Match Padel Silkeborg',
    'ØBG Tennis & Padel, Silkeborg (Halbooking)',
    'Padel Lounge Herning (Halbooking)',
    'Match Padel Odense',
    'Vissenbjerg Padel (MATCHi)',
    'Nr. Lyndelse Padeltennis (MATCHi)',
    'Breintholtgård Padel, Esbjerg (MATCHi)',
    'K7 Padel, Løsning (MATCHi)',
    'XPADEL Helsingør (Halbooking)',
    'PADELPIT Roskilde (Halbooking)',
    'PADELPIT Karlslunde (Halbooking)',
    'Padel4alle Køge (MATCHi)',
    'Padel North Kokkedal (MATCHi)',
    'Padel Yard Reffen (MATCHi)',
    'VI Padel Slagelse (MATCHi)',
    'Køge Tennis og Padel Klub (Halbooking)',
    'Allerød Tennis & Padel (Halbooking)',
    'Tisvilde Tennis & Padel (Halbooking)',
    'Hillerød Tennis & Padelklub (Halbooking)',
    'Match Padel Ballerup',
    'Match Padel Ballerup (singlebaner)',
    'Match Padel Næstved',
    'Match Padel Nykøbing Falster',
    'Racket Club Taastrup (MATCHi)',
  ].map((t) => normalizeVenueTitleKey(t))
);

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

/**
 * Gæt indoor fra Padellife-titel/URL (mange tennis-klubber = udendørs padel).
 * @param {string} title
 * @param {string} bookingUrl
 */
function guessLinkVenueIndoor(title, bookingUrl) {
  const s = `${title} ${bookingUrl}`.toLowerCase();
  if (/(udendørs|udendors|outdoor|bornholm-outdoor|\/outdoor)/i.test(s)) return false;
  if (/(indendørs|indendors|indoor|bornholm-padelcenter)/i.test(s)) return true;

  const indoorRe = [
    /\bmatch padel\b/i,
    /\bpadel yard\b/i,
    /\brocket padel\b/i,
    /\bpadel center\b/i,
    /\bpadelcenter\b/i,
    /\bpadel house\b/i,
    /\bpadel lounge\b/i,
    /\bpadelpit\b/i,
    /\bxpadel\b/i,
    /\bvamoz\b/i,
    /\bheylo\b/i,
    /\barena\b/i,
    /\bmulticenter\b/i,
    /\bracket club\b/i,
    /\bthe padel club\b/i,
    /\bsimons padel\b/i,
    /\bplay padel\b/i,
    /\beventyr padel\b/i,
    /\bodense padel center\b/i,
    /\bnordfyns padel center\b/i,
    /\bmøns padel center\b/i,
    /\bvi padel\b/i,
    /\bpadel north\b/i,
    /\bpadel99\b/i,
    /\bsport & event\b/i,
    /\b9650 padel\b/i,
    /\bpadel zone\b/i,
    /\bpadel lab\b/i,
    /\bpadel pit\b/i,
    /\bpadelpadel\b/i,
  ];
  for (const re of indoorRe) {
    if (re.test(s) || re.test(title)) return true;
  }

  const outdoorRe = [
    /\b(tennisklub|tennis klub|tennis- og padel|tennis og padel|tennis & padel)\b/i,
    /\b(tennis-klub|tennisklub)\b/i,
    /\b(golf|strand resort|feddet|lawn tennis)\b/i,
    /\bpadel danmark\b/i,
    /\bholbæk padel klub\b/i,
    /\bhaslev padel\b/i,
    /\bborren padel\b/i,
    /\btennis club\b/i,
    /\btennis og padel klub\b/i,
    /\btennis & padel klub\b/i,
    /\btennis- og padelklub\b/i,
    /\bif tennis\b/i,
    /\bif padel\b/i,
    /\bgsgif\b/i,
    /\btennis\.dk\b/i,
    /\bmemberlink\.dk\b/i,
    /\bmono\.net\b/i,
  ];
  for (const re of outdoorRe) {
    if (re.test(title)) return false;
  }

  if (/padellounge|padelpit|xpadel|padelmaster|matchpadel|sportshallen|halbooking/i.test(s)) {
    return true;
  }
  if (/\btennis\b/i.test(title)) return false;
  return true;
}

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
  if (INTEGRATED_TITLE_KEYS.has(normalizeVenueTitleKey(title))) continue;

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
    indoor: guessLinkVenueIndoor(title, bookingUrl),
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
