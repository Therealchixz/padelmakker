import { parseSoegOmraedeOptions, fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';
import { fetchMatchiSchedule } from '../padelmakker-server/matchiSchedule.js';

const UA = 'PadelMakkerProbe/1';

async function matchiFacilityId(slug) {
  const html = await fetch(`https://www.matchi.se/facilities/${slug}`, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const m = html.match(/facilityId[=:"'](\d+)/);
  return m?.[1] || null;
}

async function probeMatchi(slug) {
  const id = await matchiFacilityId(slug);
  if (!id) return { slug, ok: false };
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
  const url = `https://www.matchi.se/book/schedule?facilityId=${id}&date=${today}&sport=5&week=&year=`;
  const r = await fetchMatchiSchedule(url);
  return { slug, facilityId: id, ok: !r.error && (r.courts?.length || 0) > 0, courts: r.courts?.map((c) => c.name), error: r.error };
}

async function probeHalbooking(procBaner, omraedeCandidates) {
  const html = await fetch(procBaner, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const opts = parseSoegOmraedeOptions(html);
  const results = [];
  for (const om of omraedeCandidates.length ? omraedeCandidates : opts.map((o) => o.omraede)) {
    const r = await fetchHalbookingPadelSchedule(procBaner, om);
    if (!r.error && r.courts?.length) {
      results.push({ omraede: om, label: opts.find((o) => o.omraede === om)?.label, courts: r.courts.map((c) => c.name).slice(0, 3) });
    }
  }
  return { procBaner, opts: opts.map((o) => ({ omraede: o.omraede, label: o.label })), ok: results };
}

const matchiSlugs = [
  'OPC',
  'PadelTimeNorreNebel',
  'gormshallen',
  'padelarenahedensted',
  'padelground',
];

console.log('=== MATCHi ===');
for (const s of matchiSlugs) {
  console.log(await probeMatchi(s));
}

const hal = [
  ['match_padel_gudhjem', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', ['17']],
  ['match_padel_svaneke', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', ['18']],
  ['atk_halbooking', 'https://atk.halbooking.dk/newlook/proc_baner.asp', []],
  ['midtmors', 'https://midtmors-sport.halbooking.dk/newlook/proc_baner.asp', []],
  ['padelzone', 'https://padelzone.halbooking.dk/newlook/proc_baner.asp', []],
  ['struer', 'https://struerhallerne.halbooking.dk/newlook/proc_baner.asp', []],
  ['bjerringbro', 'https://bjerringbroip.halbooking.dk/newlook/proc_baner.asp', []],
  ['oksbol', 'https://blaavandshuk.halbooking.dk/newlook/proc_baner.asp', []],
  ['padel_lounge_randers', 'https://padellounge.halbooking.dk/newlook/proc_baner.asp', []],
  ['padel_lounge_skejby', 'https://padellounge.halbooking.dk/newlook/proc_baner.asp', []],
];

console.log('\n=== Halbooking ===');
for (const [name, url, cands] of hal) {
  const r = await probeHalbooking(url, cands);
  console.log(name, JSON.stringify(r, null, 0).slice(0, 500));
}
