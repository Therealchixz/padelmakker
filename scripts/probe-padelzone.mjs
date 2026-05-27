import { readHalbookingHtml } from '../padelmakker-server/halbookingEncoding.js';
import { parseSoegOmraedeOptions, fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';

const u = 'https://padelzone.halbooking.dk/newlook/proc_baner.asp';
const h = await fetch(u).then((r) => readHalbookingHtml(r));
const m = h.match(/<select[^>]*name=["']soeg_omraede["'][^>]*>([\s\S]*?)<\/select>/i);
console.log('match', !!m, 'snippet', m?.[1]?.slice(0, 400));
console.log('parsed', parseSoegOmraedeOptions(h));
if (m) {
  for (const o of m[1].matchAll(/<option[^>]*value=['"](\d*)['"][^>]*>([^<]+)/gi)) {
    console.log('opt', o[1], o[2]);
  }
}
for (let i = 1; i <= 15; i++) {
  const r = await fetchHalbookingPadelSchedule(u, String(i));
  if (r.courts?.length) console.log('works', i, r.courts.map((c) => c.name));
}
