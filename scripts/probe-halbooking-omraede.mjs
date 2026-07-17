/** Usage: node scripts/probe-halbooking-omraede.mjs <proc_baner_url> */
const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/probe-halbooking-omraede.mjs <proc_baner_url>');
  process.exit(1);
}
const res = await fetch(url, { headers: { 'User-Agent': 'PadelMakkerProbe/1.0' } });
console.log('status', res.status, url);
const html = await res.text();
const m = html.match(/<select name="soeg_omraede"[\s\S]*?<\/select>/i);
if (!m) {
  console.log('no soeg_omraede select');
  const title = html.match(/<title>([^<]+)/i);
  console.log('title', title?.[1]?.trim());
  process.exit(0);
}
for (const o of m[0].matchAll(/<option value='(\d+)'[^>]*>([^<]+)/g)) {
  console.log(`${o[1]}\t${o[2].trim()}`);
}
