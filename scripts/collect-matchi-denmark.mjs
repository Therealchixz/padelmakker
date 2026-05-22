/**
 * Hent alle danske MATCHi padel-faciliteter (uden schedule-probe).
 * node scripts/collect-matchi-denmark.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';

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

const indexHtml = await fetch('https://www.matchi.se/facilities/index?lang=da', {
  headers: { 'User-Agent': UA },
}).then((r) => r.text());
const muniBlock = indexHtml.match(/<select[^>]*name="municipality"[\s\S]*?<\/select>/i)?.[0] || '';
const municipalityOptions = [...muniBlock.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)].map(
  (m) => ({ id: m[1], label: m[2].trim().replace(/\s*\(\d+\)\s*$/, '') })
);
const dkMunicipalities = municipalityOptions.filter((o) =>
  DK_MUNICIPALITY_NAMES.includes(o.label)
);

const byId = new Map();
const failedMunis = [];
for (const muni of dkMunicipalities) {
  const list = await fetchMunicipalityFacilities(muni.id);
  if (!list) {
    failedMunis.push(muni.label);
  } else {
    for (const f of list) {
      if (!byId.has(f.id)) byId.set(f.id, { ...f, municipalities: [muni.label] });
      else byId.get(f.id).municipalities.push(muni.label);
    }
  }
  await new Promise((r) => setTimeout(r, 500));
}

const integratedIds = new Set(Object.values(MATCHI_VENUE_ALLOWLIST).map((c) => String(c.facilityId)));
const all = [...byId.values()].filter((f) => !SKIP_SHORTNAMES.has(String(f.shortname || '').toLowerCase()));
const missing = all.filter((f) => !integratedIds.has(String(f.id)));

const report = {
  generatedAt: new Date().toISOString(),
  failedMunicipalities: failedMunis,
  total: all.length,
  integrated: all.length - missing.length,
  missing: missing.map((f) => ({
    facilityId: String(f.id),
    shortname: f.shortname,
    name: f.name,
    city: f.city,
    zipcode: f.zipcode,
    address: f.address,
    bookingUrl: `https://www.matchi.se/facilities/${f.shortname}`,
    municipalities: f.municipalities,
  })),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log('total', report.total, 'missing', report.missing.length, 'failed munis', failedMunis.length);
for (const m of report.missing) console.log(m.facilityId, m.shortname, '-', m.name);
