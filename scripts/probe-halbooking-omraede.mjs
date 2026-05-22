const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/probe-halbooking-omraede.mjs <proc_baner_url>');
  process.exit(1);
}
const res = await fetch(url, { headers: { 'User-Agent': 'PadelMakkerProbe/1.0' } });
const html = await res.text();
const m = html.match(/<select name="soeg_omraede"[\s\S]*?<\/select>/i);
if (!m) {
  console.error('select not found');
  process.exit(1);
}
for (const o of m[0].matchAll(/<option value='(\d+)'[^>]*>([^<]+)/g)) {
  console.log(`${o[1]}\t${o[2].trim()}`);
}
