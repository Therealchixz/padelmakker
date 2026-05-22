/**
 * Byg JS-entries til matchiAllowlist + banerVenues fra collect-output.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const collect = JSON.parse(readFileSync(join(__dirname, 'output/matchi-denmark-all.json'), 'utf8'));

const MANUAL = [
  { facilityId: '3124', shortname: 'padelprofessorclub', name: 'Padel Professor Club', city: 'Hasselager', zipcode: '8361', address: 'Elmegårdsvej 5', region: 'Østjylland', indoor: true },
  { facilityId: '1747', shortname: 'padelstar', name: 'Padelstar', city: 'Højbjerg', zipcode: '8270', address: '', region: 'Østjylland', indoor: true },
  { facilityId: '2347', shortname: 'padeltonhorning', name: 'Padel Tonhøring', city: 'Hørning', zipcode: '8362', address: '', region: 'Østjylland', indoor: true },
  { facilityId: '2106', shortname: 'Pakhus77', name: 'Pakhus77', city: 'Aarhus C', zipcode: '8000', address: 'Hveensgade 5', region: 'Østjylland', indoor: true },
  { facilityId: '3038', shortname: 'wepadel', name: 'WePadel', city: 'Harlev', zipcode: '8462', address: 'Hørslevvej 151C', region: 'Østjylland', indoor: true },
  { facilityId: '344', shortname: 'padelsportdk', name: 'Padelsport.dk', city: 'Odense', zipcode: '', address: '', region: 'Fyn', indoor: true },
  { facilityId: '2226', shortname: 'odensecitypadel', name: 'Odense City Padel', city: 'Odense', zipcode: '', address: '', region: 'Fyn', indoor: true },
  { facilityId: '2324', shortname: 'padel4life', name: 'Padel4Life', city: 'Odense', zipcode: '', address: '', region: 'Fyn', indoor: true },
  { facilityId: '3010', shortname: 'padelworldherning', name: 'PadelWorld Herning', city: 'Herning', zipcode: '', address: '', region: 'Vestjylland', indoor: true },
  { facilityId: '2412', shortname: 'jellingpadel', name: 'Jelling Padel', city: 'Jelling', zipcode: '', address: '', region: 'Østjylland', indoor: false },
];

const SKIP_IDS = new Set(['2625', '373']); // camping, test
const SKIP_NAME = /camping|golfcenter.*padel$/i;

function toId(shortname) {
  return (
    'matchi_' +
    String(shortname)
      .replace(/\.dk$/i, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase()
  );
}

function guessRegionSimple(v) {
  const m = (v.municipalities || [])[0] || '';
  const map = {
    'København': 'Hovedstaden', 'Rudersdal': 'Hovedstaden', 'Rødovre': 'Hovedstaden', 'Furesø': 'Hovedstaden',
    'Gribskov': 'Hovedstaden', 'Halsnæs': 'Hovedstaden', 'Hørsholm': 'Hovedstaden', 'Frederikssund': 'Sjælland',
    'Hornbæk': 'Hovedstaden', 'Slagelse': 'Sjælland', 'Sorø': 'Sjælland', 'Ringsted': 'Sjælland', 'Faxe': 'Sjælland',
    'Køge': 'Sjælland', 'Lolland': 'Sjælland', 'Odense': 'Fyn', 'Kerteminde': 'Fyn', 'Nordfyns': 'Fyn', 'Svendborg': 'Fyn',
    'Middelfart': 'Fyn', 'Assens': 'Fyn', 'Faaborg-Midtfyn': 'Fyn', 'Esbjerg': 'Sønderjylland', 'Kolding': 'Sønderjylland',
    'Vejle': 'Sønderjylland', 'Fredericia': 'Sønderjylland', 'Varde': 'Sønderjylland', 'Tønder': 'Sønderjylland',
    'Billund': 'Sønderjylland', 'Brønderslev': 'Nordjylland', 'Frederikshavn': 'Nordjylland', 'Thisted': 'Nordjylland',
    'Hjørring': 'Nordjylland', 'Morsø': 'Nordjylland', 'Jammerbugt': 'Nordjylland', 'Rebild': 'Nordjylland',
    'Herning': 'Vestjylland', 'Holstebro': 'Vestjylland', 'Ikast-Brande': 'Vestjylland', 'Ringkøbing-Skjern': 'Vestjylland',
    'Skive': 'Vestjylland', 'Viborg': 'Vestjylland', 'Silkeborg': 'Vestjylland', 'Skanderborg': 'Vestjylland',
    'Aarhus': 'Østjylland', 'Favrskov': 'Østjylland', 'Hedensted': 'Østjylland', 'Horsens': 'Østjylland',
    'Norddjurs': 'Østjylland', 'Juelsminde': 'Østjylland', 'Odsherred': 'Sjælland', 'Holbæk': 'Sjælland',
    'Risskov': 'Østjylland', 'Brenderup': 'Fyn',
  };
  if (map[m]) return map[m];
  return 'Østjylland';
}

const byId = new Map();
for (const v of [...collect.missing, ...MANUAL]) {
  const id = String(v.facilityId);
  if (SKIP_IDS.has(id) || SKIP_NAME.test(v.name)) continue;
  if (!byId.has(id)) {
    byId.set(id, {
      ...v,
      region: v.region || guessRegionSimple(v),
      indoor: v.indoor ?? !/westpadel|golf|outdoor|klit|vorupør|blokhus|ingstrup/i.test(v.name + v.shortname),
    });
  }
}

const venues = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'da'));
const NOTE = 'Oversigt fra MATCHi. Grøn = ledigt — klik åbner MATCHi med valgt dato.';

let allowlist = '';
let baner = '';
for (const v of venues) {
  const vid = toId(v.shortname);
  const addr = [v.address, v.zipcode, v.city].filter(Boolean).join(', ').replace(/\s+/g, ' ').trim() || `${v.city || 'Danmark'} — matchi.se`;
  const url = `https://www.matchi.se/facilities/${v.shortname}`;
  allowlist += `  ${vid}: {\n    facilityId: '${v.facilityId}',\n    sport: '5',\n    indoorQuery: '',\n    bookingUrl: '${url}',\n  },\n`;
  baner += `  {\n    kind: 'matchi',\n    id: '${vid}',\n    title: '${v.name.replace(/'/g, "\\'")} (MATCHi)',\n    address: '${addr.replace(/'/g, "\\'")}',\n    indoor: ${v.indoor},\n    region: '${v.region}',\n    facilityId: '${v.facilityId}',\n    sport: '5',\n    bookingUrl: '${url}',\n    note: '${NOTE}',\n  },\n`;
}

const out = join(__dirname, 'output', 'matchi-dk-generated.txt');
writeFileSync(out, `// ALLOWLIST (${venues.length})\n${allowlist}\n// BANER\n${baner}`, 'utf8');
console.log('Generated', venues.length, 'venues ->', out);
