/**
 * Scan alle Baner-venues: integrerede + link-katalog.
 * For hvert link-center: kan vi finde MATCHi/Halbooking/Bookli på bookingUrl?
 *
 * Kør: node scripts/audit-all-baner-booking.mjs
 * Output: scripts/output/baner-booking-audit.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANER_VENUES } from '../src/lib/banerVenues.js';
import { MATCHI_VENUE_ALLOWLIST } from '../padelmakker-server/matchiAllowlist.js';
import { HALBOOKING_VENUE_ALLOWLIST } from '../padelmakker-server/halbookingVenuesAllowlist.js';
import { fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';
import { fetchMatchiSchedule } from '../padelmakker-server/matchiSchedule.js';
import { matchiScheduleUrl, getMatchiVenue } from '../padelmakker-server/matchiAllowlist.js';
import { getAllowlistedVenue } from '../padelmakker-server/halbookingVenuesAllowlist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output', 'baner-booking-audit.json');
const UA = 'PadelMakkerBanerAudit/1.0';
const CONCURRENCY = 6;
const PAGE_TIMEOUT_MS = 12000;

/** @param {string} html */
export function extractBookingUrls(html) {
  const found = /** @type {{ type: string, url: string }[]} */ ([]);
  const seen = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let h = m[1].replace(/&amp;/g, '&');
    if (h.startsWith('/')) continue;
    if (!/^https?:\/\//i.test(h)) continue;
    const key = h.split('?')[0].toLowerCase();
    if (seen.has(key)) continue;
    let type = null;
    if (/matchi\.se\/facilities\//i.test(h)) type = 'matchi';
    else if (/halbooking\.dk\/newlook\/(proc_baner|default)/i.test(h)) type = 'halbooking';
    else if (/bookli\.app/i.test(h)) type = 'bookli';
    if (!type) continue;
    seen.add(key);
    if (type === 'halbooking' && /default\.asp/i.test(h)) {
      h = h.replace(/default\.asp.*$/i, 'proc_baner.asp');
    }
    found.push({ type, url: h.split('?')[0] });
  }
  return found;
}

/** @param {string} url */
function bookingUrlType(url) {
  if (/matchi\.se\/facilities\//i.test(url)) return 'matchi-direct';
  if (/halbooking\.dk/i.test(url)) return 'halbooking-direct';
  if (/bookli\.app/i.test(url)) return 'bookli-direct';
  if (/memberlink\.dk/i.test(url)) return 'memberlink';
  return 'other';
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, html: '' };
    return { ok: true, status: res.status, html: await res.text() };
  } catch (e) {
    return { ok: false, error: e.message, html: '' };
  } finally {
    clearTimeout(t);
  }
}

async function probeIntegrated(venue) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
  try {
    if (venue.kind === 'matchi') {
      const cfg = getMatchiVenue(venue.id);
      if (!cfg) return { ok: false, error: 'not in allowlist' };
      const url = matchiScheduleUrl(cfg, today);
      const r = await fetchMatchiSchedule(url);
      const courts = r.courts?.length || 0;
      const free = r.courts?.reduce((n, c) => n + (c.slots?.filter((s) => s.status === 'free').length || 0), 0) || 0;
      return { ok: !r.error && courts > 0, courts, freeSlots: free, error: r.error };
    }
    if (venue.kind === 'halbooking') {
      const cfg = getAllowlistedVenue(venue.id);
      if (!cfg) return { ok: false, error: 'not in allowlist' };
      const r = await fetchHalbookingPadelSchedule(cfg.procBaner, cfg.omraede, { targetDateYmd: today });
      const courts = r.courts?.length || 0;
      const free = r.courts?.reduce((n, c) => n + (c.slots?.filter((s) => s.status === 'free').length || 0), 0) || 0;
      return { ok: !r.error && courts > 0, courts, freeSlots: free, error: r.error };
    }
    if (venue.kind === 'bookli') {
      return { ok: true, note: 'bookli not probed in batch' };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: 'unknown kind' };
}

async function probeLink(venue) {
  const direct = bookingUrlType(venue.bookingUrl);
  const base = {
    id: venue.id,
    title: venue.title,
    region: venue.region,
    bookingUrl: venue.bookingUrl,
    directType: direct,
  };
  if (direct === 'matchi-direct' || direct === 'halbooking-direct' || direct === 'bookli-direct') {
    return {
      ...base,
      missedIntegration: true,
      reason: 'bookingUrl is already open booking API',
      discovered: [{ type: direct.replace('-direct', ''), url: venue.bookingUrl.split('?')[0] }],
    };
  }
  const page = await fetchHtml(venue.bookingUrl);
  if (!page.ok) {
    return { ...base, fetchFailed: true, error: page.error || `HTTP ${page.status}` };
  }
  const discovered = extractBookingUrls(page.html);
  const hasOpen = discovered.length > 0;
  return {
    ...base,
    missedIntegration: hasOpen,
    discovered,
    alsoInHtml: {
      matchi: /matchi\.se/i.test(page.html),
      halbooking: /halbooking\.dk/i.test(page.html),
      bookli: /bookli\.app/i.test(page.html),
    },
  };
}

async function runPool(items, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));
  return results;
}

const integrated = BANER_VENUES.filter((v) => v.kind !== 'link');
const links = BANER_VENUES.filter((v) => v.kind === 'link');

console.error(`Auditing ${integrated.length} integrerede + ${links.length} link-centre…`);

const integratedResults = await runPool(integrated, async (v) => ({
  id: v.id,
  title: v.title,
  kind: v.kind,
  region: v.region,
  probe: await probeIntegrated(v),
}));

const linkResults = await runPool(links, async (v) => probeLink(v));

const integratedBroken = integratedResults.filter((r) => !r.probe.ok);
const missedIntegration = linkResults.filter((r) => r.missedIntegration);
const fetchFailed = linkResults.filter((r) => r.fetchFailed);

const report = {
  scannedAt: new Date().toISOString(),
  totals: {
    integrated: integrated.length,
    links: links.length,
    matchiAllowlist: Object.keys(MATCHI_VENUE_ALLOWLIST).length,
    halbookingAllowlist: Object.keys(HALBOOKING_VENUE_ALLOWLIST).length,
  },
  integratedBroken,
  missedIntegration: missedIntegration.map((r) => ({
    id: r.id,
    title: r.title,
    region: r.region,
    bookingUrl: r.bookingUrl,
    directType: r.directType,
    discovered: r.discovered,
    reason: r.reason,
  })),
  fetchFailed: fetchFailed.map((r) => ({
    id: r.id,
    title: r.title,
    bookingUrl: r.bookingUrl,
    error: r.error,
  })),
  integratedOk: integratedResults.filter((r) => r.probe.ok).length,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), 'utf8');

console.log('\n=== BANER BOOKING AUDIT ===');
console.log('Integrerede OK:', report.integratedOk, '/', integrated.length);
console.log('Integrerede FEJL:', integratedBroken.length);
for (const r of integratedBroken) {
  console.log('  !', r.id, r.probe.error);
}
console.log('\nLink-centre med funden MATCHi/Halbooking/Bookli (kunne integreres):', missedIntegration.length);
for (const r of missedIntegration.slice(0, 40)) {
  const d = r.discovered?.map((x) => `${x.type}:${x.url}`).join(' | ') || r.reason;
  console.log('  +', r.title, '—', d);
}
if (missedIntegration.length > 40) console.log(`  … og ${missedIntegration.length - 40} mere (se JSON)`);
console.log('\nLink fetch fejlede:', fetchFailed.length);
console.log('\nWrote', OUT);
