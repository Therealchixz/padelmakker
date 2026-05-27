import { parseSoegOmraedeOptions, fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';

const tests = [
  ['gudhjem', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '17'],
  ['svaneke', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '18'],
  ['struer padel', 'https://struerhallerne.halbooking.dk/newlook/proc_baner.asp', '19'],
  ['bjerringbro padel', 'https://bjerringbroip.halbooking.dk/newlook/proc_baner.asp', '10'],
  ['padel_lounge aarhus', 'https://padellounge.halbooking.dk/newlook/proc_baner.asp', '4'],
];

for (const [name, url, om] of tests) {
  const r = await fetchHalbookingPadelSchedule(url, om);
  console.log(name, om, r.error || `${r.courts?.length} courts`, r.courts?.map((c) => c.name)?.slice(0, 4));
}

for (const url of [
  'https://midtmors-sport.halbooking.dk/newlook/proc_baner.asp',
  'https://padelzone.halbooking.dk/newlook/proc_baner.asp',
  'https://blaavandshuk.halbooking.dk/newlook/proc_baner.asp',
]) {
  const html = await fetch(url, { headers: { 'User-Agent': 'T/1' } }).then((r) => r.text());
  console.log('\n', url.split('/')[2], 'has select', html.includes('soeg_omraede'), 'padel opts', parseSoegOmraedeOptions(html).filter((o) => /padel/i.test(o.label)));
  for (const o of parseSoegOmraedeOptions(html).filter((o) => /padel/i.test(o.label))) {
    const r = await fetchHalbookingPadelSchedule(url, o.omraede);
    if (!r.error && r.courts?.length) console.log('  OK', o.omraede, o.label, r.courts.length);
  }
}
