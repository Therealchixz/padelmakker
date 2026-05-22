/** Probe MATCHi facility pages for Padel INDOORS vs OUTDOORS */
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';

const UA = 'PadelMakkerProbe/1';

/** @returns {{ indoorPadel: boolean, outdoorPadel: boolean, primary: 'indoor'|'outdoor'|'both'|'unknown' }} */
export function classifyMatchiPadelHtml(html) {
  const indoorPadel = /Padel\s+INDOORS/i.test(html);
  const outdoorPadel = /Padel\s+OUTDOORS/i.test(html);
  let primary = 'unknown';
  if (indoorPadel && !outdoorPadel) primary = 'indoor';
  else if (outdoorPadel && !indoorPadel) primary = 'outdoor';
  else if (indoorPadel && outdoorPadel) primary = 'both';
  return { indoorPadel, outdoorPadel, primary };
}

/** For "both": count padel courts in schedule with indoor=1 vs indoor=0 */
async function probeScheduleCourts(facilityId, sport) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
  const base = `https://www.matchi.se/book/schedule?facilityId=${facilityId}&date=${today}&sport=${sport}&week=&year=`;
  const out = {};
  for (const [key, extra] of [
    ['default', ''],
    ['indoor1', '&indoor=1'],
    ['outdoor0', '&indoor=0'],
  ]) {
    const html = await fetch(base + extra, { headers: { 'User-Agent': UA } }).then((r) => r.text());
    const courtBlocks = html.match(/class="court"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
    const names = courtBlocks
      .map((b) => {
        const m = b.match(/<h\d[^>]*>([^<]+)</i) || b.match(/court-name[^>]*>([^<]+)/i);
        return m ? m[1].trim() : '';
      })
      .filter(Boolean);
    out[key] = { courts: names.length, names: names.slice(0, 8) };
    await new Promise((r) => setTimeout(r, 100));
  }
  return out;
}

const rows = [];
for (const [id, cfg] of Object.entries(MATCHI_VENUE_ALLOWLIST)) {
  const slug = cfg.bookingUrl.replace(/.*\/facilities\//, '').replace(/%20/g, '').trim();
  const html = await fetch(`https://www.matchi.se/facilities/${slug}`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text());
  const cls = classifyMatchiPadelHtml(html);
  const sched = cls.primary === 'both' ? await probeScheduleCourts(cfg.facilityId, cfg.sport) : null;
  let indoor = cls.primary === 'indoor';
  if (cls.primary === 'outdoor') indoor = false;
  if (cls.primary === 'both' && sched) {
    const i = sched.indoor1?.courts || 0;
    const o = sched.outdoor0?.courts || 0;
    const d = sched.default?.courts || 0;
    if (i > 0 && o === 0) indoor = true;
    else if (o > 0 && i === 0) indoor = false;
    else if (d > 0 && i === 0 && o === 0) indoor = true; // default schedule, both tabs exist
    else indoor = i >= o; // prefer indoor if both have courts
  }
  rows.push({ id, primary: cls.primary, indoor, cls, sched });
  console.log(id, cls.primary, '=> indoor:', indoor, sched ? `sched i=${sched.indoor1?.courts} o=${sched.outdoor0?.courts} d=${sched.default?.courts}` : '');
  await new Promise((r) => setTimeout(r, 150));
}

console.log('\nJSON:', JSON.stringify(rows, null, 2));
