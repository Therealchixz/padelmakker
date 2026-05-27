const urls = [
  'https://eu.padeliq.io/da/padel-sport-lemvig/booking',
  'https://padelsportlemvig.com/',
];
const UA = 'PadelMakkerDiscovery/1.0';
for (const url of urls) {
  const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  console.log('\n===', url, 'len', html.length);
  for (const pat of [/bookli/gi, /padeliq/gi, /locationId/gi, /ck[a-z0-9]{20,}/gi, /graphql/gi, /api\./gi]) {
    const m = html.match(pat);
    if (m) console.log(pat, m.length, [...new Set(m)].slice(0, 5));
  }
  const ids = [...html.matchAll(/\bck[a-z0-9]{20,}\b/gi)].map((x) => x[0]);
  if (ids.length) console.log('ck ids', [...new Set(ids)].slice(0, 15));
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/gi)].map((m) => m[1]);
  console.log('js bundles', scripts.slice(0, 5));
  const padeliqScripts = url.includes('padeliq') ? scripts : [];
  for (const src of (padeliqScripts.length ? padeliqScripts : scripts).slice(0, 5)) {
    const jsUrl = src.startsWith('http') ? src : new URL(src, url).href;
    const js = await fetch(jsUrl, { headers: { 'User-Agent': UA } }).then((r) => r.text());
    const ck = [...js.matchAll(/\bck[a-z0-9]{20,}\b/gi)].map((x) => x[0]);
    if (ck.length) console.log('  ck in', jsUrl.slice(-40), [...new Set(ck)].slice(0, 8));
    if (/api\.bookli|bookli\.app|graphql/i.test(js)) console.log('  bookli ref in', jsUrl.slice(-40));
  }
}
