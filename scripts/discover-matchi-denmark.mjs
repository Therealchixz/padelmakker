/**
 * Scan MATCHi facilities index for padel in Danish municipalities.
 * Kør: node scripts/discover-matchi-denmark.mjs
 * Output: scripts/output/matchi-denmark-discovery.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';
import { fetchMatchiSchedule } from '../padelmakker-server/matchiSchedule.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output', 'matchi-denmark-discovery.json');
const UA = 'PadelMakkerDiscovery/1.0';

/** Danske kommuner på MATCHi /facilities/index (maj 2026) */
const DK_MUNICIPALITY_NAMES = [
  'Assens',
  'Billund',
  'Brønderslev',
  'Esbjerg',
  'Faaborg-Midtfyn',
  'Faxe',
  'Fredericia',
  'Frederikshavn',
  'Frederikssund',
  'Furesø',
  'Gribskov',
  'Halsnæs',
  'Hedensted',
  'Herning',
  'Hjørring',
  'Holbæk',
  'Holstebro',
  'Horsens',
  'Hørsholm',
  'Ikast-Brande',
  'Jammerbugt',
  'Juelsminde',
  'Kerteminde',
  'Kolding',
  'København',
  'Køge',
  'Langeland',
  'Lolland',
  'Middelfart',
  'Morsø',
  'Norddjurs',
  'Nordfyns',
  'Odense',
  'Odsherred',
  'Rebild',
  'Ringkøbing-Skjern',
  'Ringsted',
  'Rudersdal',
  'Rødovre',
  'Silkeborg',
  'Skanderborg',
  'Skive',
  'Slagelse',
  'Sorø',
  'Svendborg',
  'Thisted',
  'Tønder',
  'Varde',
  'Vejle',
  'Viborg',
  'Aarhus',
  'Favrskov',
  'Brenderup',
  'Hornbæk',
  'Risskov',
];

function todayYmdCopenhagen() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
}

async function findFacilitiesByMunicipality(municipalityId, retries = 3) {
  const body = new FormData();
  body.append('sport', '5');
  body.append('municipality', municipalityId);
  body.append('asJson', 'true');
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch('https://www.matchi.se/facilities/findFacilities', {
      method: 'POST',
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      body,
    });
    const text = await res.text();
    if (!res.ok || !text.trimStart().startsWith('{')) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      continue;
    }
    const data = JSON.parse(text);
    // Kun `facilities` er filtreret på kommune; `restOfFacilities` er global kort-markørliste.
    return data.facilities || [];
  }
  return [];
}

async function probeSchedule(facilityId) {
  const date = todayYmdCopenhagen();
  const url = `https://www.matchi.se/book/schedule?facilityId=${facilityId}&date=${date}&sport=5&week=&year=`;
  try {
    const r = await fetchMatchiSchedule(url);
    const courts = r.courts || [];
    return {
      ok: !r.error && courts.length > 0,
      courts: courts.length,
      courtNames: courts.slice(0, 6).map((c) => c.name),
      error: r.error || null,
    };
  } catch (e) {
    return { ok: false, courts: 0, courtNames: [], error: String(e.message || e) };
  }
}

const indexHtml = await fetch('https://www.matchi.se/facilities/index?lang=da', {
  headers: { 'User-Agent': UA },
}).then((r) => r.text());

const muniBlock = indexHtml.match(/<select[^>]*name="municipality"[\s\S]*?<\/select>/i)?.[0] || '';
const municipalityOptions = [...muniBlock.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)].map(
  (m) => ({
    id: m[1],
    label: m[2].trim().replace(/\s*\(\d+\)\s*$/, ''),
  })
);

const dkMunicipalities = municipalityOptions.filter((o) =>
  DK_MUNICIPALITY_NAMES.some((n) => o.label === n || o.label.startsWith(n))
);

console.log('DK municipalities matched', dkMunicipalities.length, 'of', DK_MUNICIPALITY_NAMES.length);
if (dkMunicipalities.length < 10) {
  console.log(
    'Sample options:',
    municipalityOptions.filter((o) => /brønd|aarhus|køben/i.test(o.label)).slice(0, 8)
  );
}

const byId = new Map();
for (const muni of dkMunicipalities) {
  const list = await findFacilitiesByMunicipality(muni.id);
  for (const f of list) {
    if (!byId.has(f.id)) {
      byId.set(f.id, { ...f, municipalities: [muni.label] });
    } else {
      byId.get(f.id).municipalities.push(muni.label);
    }
  }
  await new Promise((r) => setTimeout(r, 80));
}

const all = [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'da'));
console.log('Unique DK padel facilities', all.length);

const integratedIds = new Set(
  Object.values(MATCHI_VENUE_ALLOWLIST).map((c) => String(c.facilityId))
);
const integratedShortnames = new Set(
  Object.values(MATCHI_VENUE_ALLOWLIST).map((c) => {
    const m = c.bookingUrl.match(/\/facilities\/([^/?#]+)/i);
    return m ? m[1].toLowerCase() : '';
  })
);

const missing = all.filter(
  (f) => !integratedIds.has(String(f.id)) && !integratedShortnames.has(String(f.shortname || '').toLowerCase())
);

console.log('Already integrated', all.length - missing.length);
console.log('Missing from allowlist', missing.length);

const probed = [];
for (const f of missing) {
  const schedule = await probeSchedule(f.id);
  probed.push({
    facilityId: String(f.id),
    shortname: f.shortname,
    name: f.name,
    city: f.city,
    zipcode: f.zipcode,
    address: f.address,
    municipalities: f.municipalities,
    bookingUrl: `https://www.matchi.se/facilities/${f.shortname}`,
    schedule,
  });
  process.stdout.write(schedule.ok ? '.' : 'x');
  await new Promise((r) => setTimeout(r, 250));
}
console.log('');

const toIntegrate = probed.filter((p) => p.schedule.ok);
const failed = probed.filter((p) => !p.schedule.ok);

const report = {
  generatedAt: new Date().toISOString(),
  source: 'https://www.matchi.se/facilities/index',
  dkMunicipalityCount: dkMunicipalities.length,
  totalDkPadelFacilities: all.length,
  integratedCount: all.length - missing.length,
  missingCount: missing.length,
  scheduleOkCount: toIntegrate.length,
  scheduleFailedCount: failed.length,
  allFacilities: all.map((f) => ({
    facilityId: String(f.id),
    shortname: f.shortname,
    name: f.name,
    city: f.city,
    zipcode: f.zipcode,
    bookingUrl: `https://www.matchi.se/facilities/${f.shortname}`,
    integrated: integratedIds.has(String(f.id)),
  })),
  recommendedIntegrate: toIntegrate,
  scheduleFailed: failed,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log('Wrote', OUT);
console.log('Recommended integrate:', toIntegrate.length);
for (const p of toIntegrate) {
  console.log(`  ${p.facilityId} ${p.shortname} — ${p.name} (${p.city})`);
}
