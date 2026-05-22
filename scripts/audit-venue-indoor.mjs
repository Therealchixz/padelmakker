/**
 * Audit indoor/outdoor for integrerede baner mod verificeret katalog + live probes.
 * Kør: npm run audit:venue-indoor
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANER_INTEGRATED_INDOOR_VERIFIED } from '../src/lib/banerVenueIndoorVerified.js';
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';
import {
  classifyMatchiPadelFacility,
  matchiPadelIsPrimarilyIndoor,
} from './lib/matchiIndoorClassify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'output');
const UA = 'PadelMakkerIndoorAudit/1.1';

const venuesJs = await readFile(join(__dirname, '../src/lib/banerVenues.js'), 'utf8');

/** @type {{ id: string, current: boolean, verified: boolean, live?: boolean, liveKind?: string }[]} */
const mismatches = [];

for (const [id, verified] of Object.entries(BANER_INTEGRATED_INDOOR_VERIFIED)) {
  const re = new RegExp(
    `id:\\s*'${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?indoor:\\s*(true|false)`
  );
  const m = venuesJs.match(re);
  const current = m ? m[0].includes('indoor: true') : null;
  if (current === null) {
    mismatches.push({ id, current: false, verified, note: 'missing in banerVenues.js' });
    continue;
  }
  if (current !== verified) {
    mismatches.push({ id, current, verified });
  }
}

/** Live MATCHi probe */
const matchiLive = {};
for (const [id, cfg] of Object.entries(MATCHI_VENUE_ALLOWLIST)) {
  const slug = cfg.bookingUrl.replace(/.*\/facilities\//, '').replace(/%20/g, '').trim();
  const html = await fetch(`https://www.matchi.se/facilities/${slug}`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text());
  const kind = classifyMatchiPadelFacility(html);
  const live = matchiPadelIsPrimarilyIndoor(html);
  matchiLive[id] = { kind, live };
  const verified = BANER_INTEGRATED_INDOOR_VERIFIED[id];
  if (verified !== undefined && live !== verified) {
    mismatches.push({
      id,
      current: verified,
      verified,
      live,
      liveKind: kind,
      note: 'MATCHi live probe differs from verified map',
    });
  }
  await new Promise((r) => setTimeout(r, 120));
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  join(OUT_DIR, 'venue-indoor-audit.json'),
  JSON.stringify({ mismatches, matchiLive }, null, 2),
  'utf8'
);

if (mismatches.length) {
  console.error('INDOOR AUDIT FAILED —', mismatches.length, 'issue(s):');
  for (const x of mismatches) {
    console.error(
      ' ',
      x.id,
      x.note || `banerVenues indoor:${x.current} expected:${x.verified}`,
      x.liveKind ? `live=${x.live} (${x.liveKind})` : ''
    );
  }
  process.exit(1);
}

console.log('OK — all', Object.keys(BANER_INTEGRATED_INDOOR_VERIFIED).length, 'integrerede baner matcher indoor-kataloget');
