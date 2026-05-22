const res = await fetch('https://matchpadel.halbooking.dk/newlook/proc_baner.asp', {
  headers: { 'User-Agent': 'PadelMakkerProbe/1.0' },
});
const html = await res.text();
const m = html.match(/<select name="soeg_omraede"[\s\S]*?<\/select>/i);
if (!m) {
  console.error('select not found');
  process.exit(1);
}
for (const o of m[0].matchAll(/<option value='(\d+)'[^>]*>([^<]+)/g)) {
  console.log(`${o[1]}\t${o[2].trim()}`);
}
