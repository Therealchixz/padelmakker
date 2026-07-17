/**
 * Hent ledige tider via Playtomics offentlige web-BFF (playtomic.com/api/clubs/availability).
 * Direkte api.playtomic.io er ofte CloudFront-blokeret fra server-IP'er.
 */

import { DateTime } from 'luxon';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** @type {Map<string, { at: number, map: Map<string, string> }>} */
const resourceNameCache = new Map();
const RESOURCE_CACHE_MS = 60 * 60 * 1000;

/**
 * @param {string} clubSlug
 * @returns {Promise<Map<string, string>>}
 */
export async function fetchPlaytomicResourceNames(clubSlug) {
  const cached = resourceNameCache.get(clubSlug);
  if (cached && Date.now() - cached.at < RESOURCE_CACHE_MS) return cached.map;

  const res = await fetch(`https://playtomic.com/clubs/${encodeURIComponent(clubSlug)}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`Playtomic klubside ${res.status}`);
  }
  const html = await res.text();
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const m of html.matchAll(
    /"resourceId"\s*:\s*"([0-9a-f-]{36})"\s*,\s*"name"\s*:\s*"((?:\\.|[^"\\])*)"/gi
  )) {
    const id = m[1];
    const name = m[2].replace(/\\"/g, '"').replace(/\\u([0-9a-f]{4})/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
    if (id && name) map.set(id, name.trim());
  }
  resourceNameCache.set(clubSlug, { at: Date.now(), map });
  return map;
}

/**
 * Preferér 60-min slots; ellers første varighed pr. starttid.
 * @param {{ start_time?: string, duration?: number, price?: string }[]} slots
 */
function pickPreferredSlots(slots) {
  /** @type {Map<string, { start_time: string, duration: number, price?: string }>} */
  const best = new Map();
  for (const s of slots || []) {
    const start = String(s.start_time || '').slice(0, 8);
    if (!/^\d{2}:\d{2}:\d{2}$/.test(start)) continue;
    const duration = Number(s.duration) || 0;
    const prev = best.get(start);
    if (!prev || duration === 60 || (prev.duration !== 60 && duration < prev.duration)) {
      best.set(start, { start_time: start, duration, price: s.price });
    }
  }
  return [...best.values()].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * @param {string} startTime HH:MM:SS
 */
function toHm(startTime) {
  return String(startTime).slice(0, 5);
}

/**
 * @param {{ tenantId: string, clubSlug: string }} cfg
 * @param {string} dateYmd
 */
export async function fetchPlaytomicSchedule(cfg, dateYmd) {
  if (!cfg?.tenantId || !cfg?.clubSlug) {
    return { error: 'Ugyldig Playtomic-konfiguration' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return { error: 'Ugyldig dato' };
  }

  const availUrl =
    `https://playtomic.com/api/clubs/availability` +
    `?tenant_id=${encodeURIComponent(cfg.tenantId)}` +
    `&date=${encodeURIComponent(dateYmd)}` +
    `&sport_id=PADEL`;

  const [availRes, nameMap] = await Promise.all([
    fetch(availUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: `https://playtomic.com/clubs/${cfg.clubSlug}`,
      },
    }),
    fetchPlaytomicResourceNames(cfg.clubSlug).catch(() => new Map()),
  ]);

  if (!availRes.ok) {
    return { error: `Playtomic availability ${availRes.status}` };
  }

  let rows;
  try {
    rows = await availRes.json();
  } catch {
    return { error: 'Playtomic returnerede ugyldig JSON' };
  }
  if (!Array.isArray(rows)) {
    return { error: 'Uventet Playtomic-svar' };
  }

  /** @type {{ id: string, name: string, slots: { time: string, status: string }[], available: string[] }[]} */
  const courts = [];

  for (const row of rows) {
    const resourceId = String(row.resource_id || '');
    if (!resourceId) continue;
    const preferred = pickPreferredSlots(row.slots || []);
    if (preferred.length === 0) continue;
    const name = nameMap.get(resourceId) || `Bane ${resourceId.slice(0, 8)}`;
    const slots = preferred.map((s) => ({
      time: toHm(s.start_time),
      status: 'free',
    }));
    courts.push({
      id: resourceId,
      name,
      slots,
      available: slots.map((s) => s.time),
    });
  }

  courts.sort((a, b) => a.name.localeCompare(b.name, 'da'));

  const dateLabel = DateTime.fromISO(dateYmd, { zone: 'Europe/Copenhagen' })
    .setLocale('da')
    .toFormat('cccc d. LLLL yyyy');

  return {
    courts,
    dateLabel,
    scheduleDate: dateYmd,
  };
}
