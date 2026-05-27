import { readHalbookingHtml } from '../padelmakker-server/halbookingEncoding.js';
import {
  collectInputFields,
  parseCourts,
  scheduleLooksLikePadel,
  fetchHalbookingPadelSchedule,
} from '../padelmakker-server/halbookingFetch.js';

const url = 'https://padellounge.halbooking.dk/newlook/proc_baner.asp';

async function rawPost(omraede) {
  const r1 = await fetch(url, { headers: { 'User-Agent': 'PadelMakker/1' } });
  const html0 = await readHalbookingHtml(r1);
  const form = html0.match(/<form[^>]*id="multiform"[^>]*>([\s\S]*?)<\/form>/i)[1];
  const params = collectInputFields(form);
  params.set('soeg_omraede', omraede);
  params.set('mf_funktion', 'omr_soeg');
  params.set('mf_para1', '');
  params.set('mf_para2', '');
  params.set('mf_para3', '');
  params.set('mf_para4', '');
  const r2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'PadelMakker/1',
    },
    body: params.toString(),
  });
  return readHalbookingHtml(r2);
}

for (const om of ['2', '3']) {
  const html = await rawPost(om);
  const { courts, error } = parseCourts(html);
  const h = html.match(/min420'>\s*-\s*([^<]+)/)?.[1];
  console.log('omraede', om, 'heading', h);
  console.log('  courts', courts?.map((c) => c.name));
  console.log('  parseErr', error);
  console.log('  looksPadel', scheduleLooksLikePadel(courts, html));
}

const viaFetch = await fetchHalbookingPadelSchedule(url, '3');
console.log('fetchHalbookingPadelSchedule(3)', viaFetch.error || viaFetch.courts?.map((c) => c.name));
