/** Probe candidate Playtomic DK club slugs. */
const candidates = [
  'padelboxen',
  'padel-dk',
  'the-padel-club-espergaerde',
  'padel-herlev',
  'padel6100',
  'padel-6100',
  'coreone-padel',
  'coreonepadel',
  'core-one-padel',
  'sambiosen',
  'sam-biosen',
  'padel-samsø',
  'padel-samso',
  'samso-padel',
  'ikast-padel',
  'coreone-padel-ikast',
  'padel-odense',
  'padelodense',
  'greenpadel',
  'padel-aarhus',
  'padel-aalborg',
  'padel-kobenhavn',
  'padel-copenhagen',
  'heylo-padel',
  'vamoz',
  'vamoz-padel',
  'play-padel',
  'playpadel',
  'eventyrpadel',
  'odense-eventyr-padel',
  'simonspadel',
  'simons-padel-club',
  'padelon',
  'one-padel',
  'padelsport',
  'ground-fitness',
  'padelhouse',
  'we-are-padel',
  'padelpadel',
];

const ua = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const found = [];
for (const slug of candidates) {
  const r = await fetch(`https://playtomic.com/clubs/${slug}`, {
    headers: ua,
    redirect: 'follow',
  });
  if (r.status !== 200) {
    process.stdout.write('.');
    continue;
  }
  const html = await r.text();
  if (/page not found|404|__next_error__/i.test(html) && !/tenant-id=/i.test(html)) {
    process.stdout.write('x');
    continue;
  }
  const tenant =
    html.match(/tenant-id="([0-9a-f-]{36})"/i)?.[1] ||
    html.match(/tenant_id=([0-9a-f-]{36})/i)?.[1];
  const title =
    html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
    html.match(/<title>([^|<]+)/i)?.[1]?.trim();
  const addr = html.match(/([A-Za-zæøåÆØÅ .'-]+\d+[A-Za-z]?\s*,\s*\d{4})/)?.[1];
  found.push({ slug, tenant, title, addr: addr || null, len: html.length });
  process.stdout.write('+');
}
console.log('\n');
console.log(JSON.stringify(found, null, 2));
