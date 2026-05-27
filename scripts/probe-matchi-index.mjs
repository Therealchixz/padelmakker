/**
 * One-off probe: MATCHi facilities index structure.
 * node scripts/probe-matchi-index.mjs
 */

const url = 'https://www.matchi.se/facilities/index?lang=da';
const res = await fetch(url, {
  headers: { 'User-Agent': 'PadelMakkerDiscovery/1.0', Accept: 'text/html' },
});
const html = await res.text();
console.log('status', res.status, 'len', html.length);

const facLinks = [...html.matchAll(/href="(\/facilities\/[^"#?]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(facLinks)].filter((x) => x !== '/facilities/index');
console.log('facility path links', uniq.length);

const padelBlocks = [...html.matchAll(/facilities\/([^"?\s]+)[^>]*>[\s\S]{0,200}?padel/gi)];
console.log('padel near links (sample)', padelBlocks.slice(0, 5).map((m) => m[1]));

// Danish municipalities from MATCHi (kommune filter)
const dkPattern =
  /Brønderslev|København|Aarhus|Frederikssund|Hedensted|Herning|Holstebro|Horsens|Viborg|Odense|Vejle|Esbjerg|Kolding|Slagelse|Køge|Ringsted|Thisted|Hjørring|Morsø|Jammerbugt|Rebild|Faxe|Holbæk|Assens|Billund|Faaborg|Middelfart|Nordfyns|Svendborg|Tønder|Varde|Silkeborg|Skanderborg|Skive|Favrskov|Norddjurs|Ringkøbing|Ikast|Juelsminde|Brenderup/i;
console.log('DK municipalities mentioned', dkPattern.test(html));

// Look for JSON bootstrap / API
for (const pat of [/window\.__[A-Z_]+/g, /"facilities":/g, /facilityId/g]) {
  const m = html.match(pat);
  console.log(String(pat), m ? (m.length > 20 ? m.length + ' hits' : m.slice(0, 3)) : 'none');
}

// sport=5 padel filter in page
console.log('sport padel (5)', /sport[=:]["']?5/.test(html) || /Padel/i.test(html));

const formMatch = html.match(/<form[^>]*id="[^"]*facilit[^]*?<\/form>/is);
if (formMatch) {
  const names = [...formMatch[0].matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
  console.log('form names', [...new Set(names)]);
}

const body = new FormData();
body.append('sport', '5');
body.append('asJson', 'true');
const jsonRes = await fetch('https://www.matchi.se/facilities/findFacilities', {
  method: 'POST',
  headers: { 'User-Agent': 'PadelMakkerDiscovery/1.0' },
  body,
});
console.log('findFacilities status', jsonRes.status);
const data = await jsonRes.json().catch(() => null);
if (data) {
  const all = [...(data.facilities || []), ...(data.restOfFacilities || [])];
  console.log('facilities count (global padel)', all.length);
  /** Denmark-ish bounding box */
  const dk = all.filter(
    (f) => f.lat >= 54.4 && f.lat <= 58.1 && f.lng >= 7.8 && f.lng <= 15.3
  );
  console.log('DK bbox padel', dk.length);
  dk.sort((a, b) => (a.city || '').localeCompare(b.city || '', 'da'));
  for (const f of dk) {
    console.log(`${f.id}\t${f.shortname}\t${f.name}\t${f.city}`);
  }
}
