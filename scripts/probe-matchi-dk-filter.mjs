/**
 * Refine Denmark filter for MATCHi padel facilities.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const indexHtml = await fetch('https://www.matchi.se/facilities/index?lang=da', {
  headers: { 'User-Agent': 'PadelMakkerDiscovery/1.0' },
}).then((r) => r.text());

// Municipality options: value is id, label is "Name (count)"
const muniBlock = indexHtml.match(/<select[^>]*name="municipality"[\s\S]*?<\/select>/i)?.[0] || '';
const municipalities = [...muniBlock.matchAll(/<option value="([^"]*)"[^>]*>([^<]+)<\/option>/gi)].map((m) => ({
  id: m[1],
  label: m[2].trim(),
}));

const body = new FormData();
body.append('sport', '5');
body.append('asJson', 'true');
const data = await fetch('https://www.matchi.se/facilities/findFacilities', {
  method: 'POST',
  headers: { 'User-Agent': 'PadelMakkerDiscovery/1.0' },
  body,
}).then((r) => r.json());

const all = [...(data.facilities || []), ...(data.restOfFacilities || [])];

/** Danish postcodes are 4 digits; Swedish often "NNN NN" in zipcode field */
function looksDanishZip(zip) {
  const z = String(zip || '').trim();
  return /^\d{4}$/.test(z);
}

/** Cities with Danish letters or known DK-only names */
function looksDanishCity(city) {
  const c = String(city || '').trim();
  if (!c) return false;
  if (/[øæåØÆÅ]/.test(c)) return true;
  const dkOnly = /^(Brønderslev|København|Rødovre|Hedensted|Horsens|Holstebro|Slagelse|Grenaa|Skagen|Viborg|Odense|Vejle|Esbjerg|Kolding|Fredericia|Frederikshavn|Frederikssund|Ringsted|Køge|Haslev|Gilleleje|Hornbæk|Humlebæk|Vedbæk|Brenderup|Juelsminde|Børkop|Vorbasse|Varde|Thisted|Hillerød|Risskov|Århus|Aarhus|Aarup|Galten|Gedved|Glamsbjerg|Bogense|Dianalund|Assens|Faaborg|Fårevejle|Otterup|Søndersø|Skive|Skjern|Skælskør|Skærbæk|Rønnede|Rømø|Humble|Værløse|Tørring|Middelfart)/i;
  return dkOnly.test(c);
}

const dkZip = all.filter((f) => looksDanishZip(f.zipcode));
const dkCity = all.filter((f) => looksDanishCity(f.city));
const dkEither = all.filter((f) => looksDanishZip(f.zipcode) || looksDanishCity(f.city));

console.log('municipalities in form', municipalities.length);
console.log('padel global', all.length);
console.log('dk zip 4-digit', dkZip.length);
console.log('dk city heuristic', dkCity.length);
console.log('dk either', dkEither.length);

const integratedIds = new Set(
  Object.values(MATCHI_VENUE_ALLOWLIST).map((c) => String(c.facilityId))
);

const missing = dkEither.filter((f) => !integratedIds.has(String(f.id)));
missing.sort((a, b) => (a.city || '').localeCompare(b.city || '', 'da'));

console.log('\n--- Missing from allowlist (' + missing.length + ') ---');
for (const f of missing) {
  console.log(
    `${f.id}\t${f.shortname}\t${f.name}\t${f.city}\t${f.zipcode || ''}\t${f.address || ''}`
  );
}

const out = join(__dirname, 'output', 'matchi-denmark-padel.json');
writeFileSync(
  out,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      integratedCount: integratedIds.size,
      denmarkPadelCount: dkEither.length,
      missing: missing.map((f) => ({
        facilityId: String(f.id),
        shortname: f.shortname,
        name: f.name,
        city: f.city,
        zipcode: f.zipcode,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        bookingUrl: `https://www.matchi.se/facilities/${f.shortname}`,
      })),
    },
    null,
    2
  ),
  'utf8'
);
console.log('\nWrote', out);
