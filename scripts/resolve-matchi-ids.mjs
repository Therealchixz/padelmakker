/** Resolve facilityId for MATCHi slugs (slow, avoids 429). */
const SLUGS = [
  'padelprofessorclub',
  'padelstar',
  'padeltonhorning',
  'Pakhus77',
  'wepadel',
  'padelsportdk',
  'odensecitypadel',
  'padel4life',
  'padelworldherning',
  'lunden',
];
const UA = 'PadelMakkerDiscovery/1.0';
for (const slug of SLUGS) {
  const url = `https://www.matchi.se/facilities/${slug}`;
  const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const m = html.match(/facilityId[=:"'](\d+)/);
  console.log(slug, m?.[1] || 'NONE');
  await new Promise((r) => setTimeout(r, 2000));
}
