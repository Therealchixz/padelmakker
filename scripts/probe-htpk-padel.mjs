import { readHalbookingHtml } from '../padelmakker-server/halbookingEncoding.js';
import { fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';
const url = 'https://htpk.halbooking.dk/newlook/proc_baner.asp';
const r = await fetch(url, { headers: { 'User-Agent': 'x' } });
const html = await readHalbookingHtml(r);
const selects = html.matchAll(/<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi);
for (const m of selects) {
  console.log('\nSELECT', m[1]);
  for (const o of m[2].matchAll(/<option[^>]*value=["']?([^"'>\s]*)/gi)) {
    const label = o[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('  ', o[1], '|', label.slice(0, 80));
  }
}

// Try padel link / hidden fields
const padelBtn = html.match(/Padel[\s\S]{0,300}/gi);
console.log('\n--- padel context ---');
for (const p of (padelBtn || []).slice(0, 3)) console.log(p.slice(0, 200));

// Test omraede values 3-10
for (const om of ['', '1', '2', '3', '4', '5', '6', '7', '8']) {
  const res = await fetchHalbookingPadelSchedule(url, om);
  const title = res.dateLabel || res.error;
  const names = res.courts?.map((c) => c.name).join(', ') || '';
  const isPadel = /padel/i.test(names) || /# Padel/i.test(title);
  console.log(`omraede=${om}`, isPadel ? 'PADEL?' : 'tennis?', title, names.slice(0, 80));
}
