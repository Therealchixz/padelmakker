import { readHalbookingHtml } from '../padelmakker-server/halbookingEncoding.js';
import {
  collectInputFields,
  parseSoegOmraedeOptions,
  resolveHalbookingOmraede,
  parseCourts,
  scheduleLooksLikePadel,
  fetchHalbookingPadelSchedule,
} from '../padelmakker-server/halbookingFetch.js';

const u = 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp';
const html0 = await fetch(u, { headers: { 'User-Agent': 'T/1' } }).then((r) => readHalbookingHtml(r));
const opts = parseSoegOmraedeOptions(html0);
console.log('resolve 5', resolveHalbookingOmraede('5', opts));
const r = await fetchHalbookingPadelSchedule(u, '5');
console.log('fetch', r.soegOmrAede, r.error || r.courts?.map((c) => c.name));

const form = html0.match(/<form[^>]*id="multiform"[^>]*>([\s\S]*?)<\/form>/i)[1];
const params = collectInputFields(form);
params.set('soeg_omraede', '5');
params.set('mf_funktion', 'omr_soeg');
for (const p of ['mf_para1', 'mf_para2', 'mf_para3', 'mf_para4']) params.set(p, '');
const html = await fetch(u, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params.toString(),
}).then((res) => readHalbookingHtml(res));
const { courts } = parseCourts(html);
console.log('raw courts', courts?.map((c) => c.name));
console.log('looks padel', scheduleLooksLikePadel(courts, html));
