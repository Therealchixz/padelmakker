import { fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';

const targets = [
  ['smash horsens double', 'https://smash.halbooking.dk/newlook/proc_baner.asp', '1'],
  ['smash horsens single', 'https://smash.halbooking.dk/newlook/proc_baner.asp', '5'],
  ['smash stensballe', 'https://smash.halbooking.dk/newlook/proc_baner.asp', '6'],
  ['lounge odense', 'https://padellounge.halbooking.dk/newlook/proc_baner.asp', '5'],
  ['match studio', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '20'],
  ['match kløvermarken', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '3'],
  ['match silkeborg syd', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '4'],
  ['match bornholm inde', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '13'],
  ['match bornholm ude rønne', 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', '10'],
  ['lezgo', 'https://lezgopadel.halbooking.dk/newlook/proc_baner.asp', ''],
  ['lets padel', 'https://letspadel.halbooking.dk/newlook/proc_baner.asp', ''],
];

for (const [label, url, om] of targets) {
  try {
    const r = await fetchHalbookingPadelSchedule(url, om);
    if (r.error) {
      console.log(label, 'ERROR', r.error);
      continue;
    }
    const free = (r.courts || []).reduce(
      (n, c) => n + (c.slots || []).filter((s) => s.status === 'free').length,
      0
    );
    console.log(
      label,
      'courts',
      r.courts?.length,
      'names',
      r.courts?.map((c) => c.name).slice(0, 6).join(' | '),
      'freeSlots',
      free
    );
  } catch (e) {
    console.log(label, 'THROW', e.message);
  }
}
