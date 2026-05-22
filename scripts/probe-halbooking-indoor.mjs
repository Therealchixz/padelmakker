/** Probe Halbooking padel områder for indoor/outdoor hints */
import { HALBOOKING_VENUE_ALLOWLIST } from '../padelmakker-server/halbookingVenuesAllowlist.js';
import {
  parseSoegOmraedeOptions,
  fetchHalbookingPadelSchedule,
} from '../padelmakker-server/halbookingFetch.js';

const UA = 'PadelMakkerProbe/1';

function classify(labels, courtNames) {
  const t = `${labels} ${courtNames}`.toLowerCase();
  const hasIndoor = /indend|indoor|i hal|sportshall|hal\b|arena|lounge|match padel|xpadel|padelpit|padelmaster/i.test(t);
  const hasOutdoor = /udend|outdoor|ude\b|gård|have/i.test(t);
  if (/udendørs padel|udendors padel|padel udend/i.test(t)) return 'outdoor';
  if (hasOutdoor && !hasIndoor) return 'outdoor';
  if (hasIndoor && !hasOutdoor) return 'indoor';
  if (/padel$/i.test(labels.trim()) && !hasOutdoor) return 'indoor'; // generic "Padel" in hal = often indoor
  return 'unknown';
}

for (const [id, cfg] of Object.entries(HALBOOKING_VENUE_ALLOWLIST)) {
  try {
    const html = await fetch(cfg.procBaner, { headers: { 'User-Agent': UA } }).then((r) => r.text());
    const options = parseSoegOmraedeOptions(html);
    const selected = options.find((o) => String(o.value) === String(cfg.omraede));
    const padelOpts = options.filter((o) => /padel/i.test(o.label));
    const labels = (selected ? [selected.label] : padelOpts.map((o) => o.label)).join(' | ');
    const sched = await fetchHalbookingPadelSchedule(cfg.procBaner, cfg.omraede);
    const courtNames = sched.courts?.map((c) => c.name).join(' ') || '';
    const inferred = classify(labels, courtNames);
    const indoor = inferred === 'indoor' || inferred === 'unknown'; // unknown halbooking padel centres → indoor default except known outdoor
    const forceOutdoor = ['skansen_ntsc', 'himmerland_halbooking'].includes(id);
    console.log(
      id,
      'omraede',
      cfg.omraede,
      '=>',
      forceOutdoor ? 'outdoor' : inferred,
      'indoor:',
      forceOutdoor ? false : inferred === 'outdoor' ? false : indoor,
      '|',
      labels.slice(0, 60),
      '| courts:',
      courtNames.slice(0, 80)
    );
  } catch (e) {
    console.log(id, 'ERROR', e.message);
  }
  await new Promise((r) => setTimeout(r, 150));
}
