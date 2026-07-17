/** Extract tenant_id + court names from Playtomic club pages. */
const paths = [
  'padelboxen',
  'padel-dk',
  'the-padel-club-espergaerde',
  'padel-herlev',
];

const ua = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

for (const path of paths) {
  const html = await (await fetch(`https://playtomic.com/clubs/${path}`, { headers: ua })).text();
  const tenant =
    html.match(/tenant-id="([0-9a-f-]{36})"/i)?.[1] ||
    html.match(/tenant_id=([0-9a-f-]{36})/i)?.[1];
  const courts = [...html.matchAll(/>(Bane[^<]{0,80}|Center Court[^<]{0,40}|Double Bane[^<]{0,40}|Single[^<]{0,40}|Padel \d|Faxe Kondi[^<]{0,40}|Magasin banen|Spar Nord banen)</gi)].map(
    (m) => m[1].trim()
  );
  console.log(JSON.stringify({ path, tenant, courts: [...new Set(courts)].slice(0, 20) }, null, 2));
}
