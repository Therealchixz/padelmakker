import { fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';

const procBaner = 'https://padelmaster.halbooking.dk/newlook/proc_baner.asp';

// Prøv uden omraede (kun procBaner)
for (const om of ['', '1', '0']) {
  const r = await fetchHalbookingPadelSchedule(procBaner, om);
  console.log(`omraede="${om}"`, r.error || `courts=${r.courts?.length}`, r.courts?.map((c) => c.name));
}
