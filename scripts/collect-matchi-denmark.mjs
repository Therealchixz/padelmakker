/**
 * Hent alle danske MATCHi padel-faciliteter (uden schedule-probe).
 * node scripts/collect-matchi-denmark.mjs
 * node scripts/collect-matchi-denmark.mjs --only-failed
 * MUNI_DELAY_MS=800 node scripts/collect-matchi-denmark.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';

const onlyFailed = process.argv.includes('--only-failed');
const MUNI_DELAY_MS = Math.max(300, parseInt(process.env.MUNI_DELAY_MS || '800', 10) || 800);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output', 'matchi-denmark-all.json');
const UA = 'PadelMakkerDiscovery/1.0';

const DK_MUNICIPALITY_NAMES = [
  'Assens', 'Billund', 'Brønderslev', 'Esbjerg', 'Faaborg-Midtfyn', 'Faxe', 'Fredericia',
  'Frederikshavn', 'Frederikssund', 'Furesø', 'Gribskov', 'Halsnæs', 'Hedensted', 'Herning',
  'Hjørring', 'Holbæk', 'Holstebro', 'Horsens', 'Hørsholm', 'Ikast-Brande', 'Jammerbugt',
  'Juelsminde', 'Kerteminde', 'Kolding', 'København', 'Køge', 'Langeland', 'Lolland',
  'Middelfart', 'Morsø', 'Norddjurs', 'Nordfyns', 'Odense', 'Odsherred', 'Rebild',
  'Ringkøbing-Skjern', 'Ringsted', 'Rudersdal', 'Rødovre', 'Silkeborg', 'Skanderborg', 'Skive',
  'Slagelse', 'Sorø', 'Svendborg', 'Thisted', 'Tønder', 'Varde', 'Vejle', 'Viborg', 'Aarhus',
  'Favrskov', 'Brenderup', 'Hornbæk', 'Risskov',
];

const SKIP_SHORTNAMES = new Set(['matchi test dk']);

async function fetchMunicipalityFacilities(municipalityId) {
  const body = new FormData();
  body.append('sport', '5');
  body.append('municipality', municipalityId);
  body.append('asJson', 'true');
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://www.matchi.se/facilities/findFacilities', {
      method: 'POST',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      body,
    });
    const text = await res.text();
    if (res.ok && text.trimStart().startsWith('{')) {
      return JSON.parse(text).facilities || [];
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return null;
}

function facilityToStored(f) {
  return {
    facilityId: String(f.id),
    shortname: f.shortname,
    name: f.name,
    city: f.city,
    zipcode: f.zipcode,
    address: f.address,
    municipalities: f.municipalities || [],
    bookingUrl: `https://www.matchi.se/facilities/${f.shortname}`,
  };
}

const indexHtml = await fetch('https://www.matchi.se/facilities/index?lang=da', {
  headers: { 'User-Agent': UA },
}).then((r) => r.text());
const muniBlock = indexHtml.match(/<select[^>]*name="municipality"[\s\S]*?<\/select>/i)?.[0] || '';
const municipalityOptions = [...muniBlock.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)].map(
  (m) => ({ id: m[1], label: m[2].trim().replace(/\s*\(\d+\)\s*$/, '') })
);
const allMunis = municipalityOptions.filter((o) => DK_MUNICIPALITY_NAMES.includes(o.label));

let prev = null;
try {
  prev = JSON.parse(await readFile(OUT, 'utf8'));
} catch {
  /* first run */
}

const byId = new Map();
if (onlyFailed && prev?.all?.length) {
  for (const row of prev.all) {
    byId.set(row.facilityId, {
      id: row.facilityId,
      shortname: row.shortname,
      name: row.name,
      city: row.city,
      zipcode: row.zipcode,
      address: row.address,
      municipalities: [...(row.municipalities || [])],
    });
  }
}

const munisToFetch = onlyFailed
  ? allMunis.filter((o) => (prev?.failedMunicipalities || []).includes(o.label))
  : allMunis;

if (onlyFailed) {
  console.error('Retrying', munisToFetch.length, 'failed municipalities');
}

const failedMunis = [];
const succeeded = new Set();

for (const muni of munisToFetch) {
  const list = await fetchMunicipalityFacilities(muni.id);
  if (!list) {
    failedMunis.push(muni.label);
  } else {
    succeeded.add(muni.label);
    for (const f of list) {
      const id = String(f.id);
      if (!byId.has(id)) {
        byId.set(id, { ...f, id: f.id, municipalities: [muni.label] });
      } else if (!byId.get(id).municipalities.includes(muni.label)) {
        byId.get(id).municipalities.push(muni.label);
      }
    }
  }
  await new Promise((r) => setTimeout(r, MUNI_DELAY_MS));
}

let finalFailed = failedMunis;
if (onlyFailed && prev) {
  finalFailed = [
    ...new Set([
      ...failedMunis,
      ...(prev.failedMunicipalities || []).filter((l) => !succeeded.has(l)),
    ]),
  ].filter((l) => !succeeded.has(l));
}

const integratedIds = new Set(Object.values(MATCHI_VENUE_ALLOWLIST).map((c) => String(c.facilityId)));
const allFacilities = [...byId.values()].filter(
  (f) => !SKIP_SHORTNAMES.has(String(f.shortname || '').toLowerCase())
);
const all = allFacilities.map(facilityToStored);
const missing = all.filter((f) => !integratedIds.has(f.facilityId));

const report = {
  generatedAt: new Date().toISOString(),
  failedMunicipalities: finalFailed,
  total: all.length,
  integrated: all.length - missing.length,
  all,
  missing,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log('total', report.total, 'missing', report.missing.length, 'failed munis', finalFailed.length);
for (const m of missing.slice(0, 30)) console.log(m.facilityId, m.shortname, '-', m.name);
if (missing.length > 30) console.log('…', missing.length - 30, 'more');
