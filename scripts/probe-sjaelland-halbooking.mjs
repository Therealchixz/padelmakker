import { fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';

const MATCH_PADEL = 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp';

/** @type {{ id: string, procBaner: string, omraede: string }[]} */
const CANDIDATES = [
  { id: 'hitk_hillerod', procBaner: 'https://hitk.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'hitk_hillerod_1', procBaner: 'https://hitk.halbooking.dk/newlook/proc_baner.asp', omraede: '1' },
  { id: 'hitk_hillerod_5', procBaner: 'https://hitk.halbooking.dk/newlook/proc_baner.asp', omraede: '5' },
  { id: 'match_padel_ballerup', procBaner: MATCH_PADEL, omraede: '6' },
  { id: 'match_padel_ballerup_7', procBaner: MATCH_PADEL, omraede: '7' },
  { id: 'match_padel_naestved', procBaner: MATCH_PADEL, omraede: '15' },
  { id: 'match_padel_nykobing', procBaner: MATCH_PADEL, omraede: '9' },
  { id: 'albertslund', procBaner: 'https://albertslund-tennis.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'gladsaxe', procBaner: 'https://gladsaxetennisklub.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'holbaek', procBaner: 'https://holbaekpadel.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'ringsted', procBaner: 'https://padelclubringsted.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'lynge', procBaner: 'https://lui.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'vallensbaek', procBaner: 'https://vallensbaektennisklub.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
  { id: 'olstykke', procBaner: 'https://olstykketennisklub.halbooking.dk/newlook/proc_baner.asp', omraede: '' },
];

for (const c of CANDIDATES) {
  const r = await fetchHalbookingPadelSchedule(c.procBaner, c.omraede);
  const ok = !r.error && r.courts?.length > 0;
  console.log(ok ? 'OK' : 'FAIL', c.id, `omraede=${c.omraede}`, r.error || `courts=${r.courts?.length}`, r.courts?.map((x) => x.name)?.slice(0, 3));
  await new Promise((res) => setTimeout(res, 400));
}
