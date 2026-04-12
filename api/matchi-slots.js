/**
 * GET /api/matchi-slots?venue=matchi_padel99&date=2026-04-12
 * Server-side: henter MATCHi /book/schedule HTML og parser til BanerTab-format.
 */

import { getMatchiVenue, matchiScheduleUrl } from './lib/matchiAllowlist.js';
import { fetchMatchiSchedule } from './lib/matchiSchedule.js';
import { DateTime } from 'luxon';
import { checkRateLimit, getClientIp } from './lib/rateLimit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!checkRateLimit(getClientIp(req), 30, 60_000)) {
    res.status(429).json({ error: 'For mange forespørgsler. Prøv igen om et øjeblik.' });
    return;
  }

  const rawUrl = req.url || '';
  const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const venueId = params.get('venue') || '';
  const dateParam = params.get('date');

  const cfg = getMatchiVenue(venueId);
  if (!cfg) {
    res.status(400).json({ error: 'Ukendt MATCHi-venue' });
    return;
  }

  const dateYmd =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : DateTime.now().setZone('Europe/Copenhagen').toISODate();

  const scheduleUrl = matchiScheduleUrl(cfg, dateYmd);

  try {
    const result = await fetchMatchiSchedule(scheduleUrl);
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.status(200).json({
      source: 'matchi_schedule_html',
      venueId,
      date: dateYmd,
      scheduleDate: dateYmd,
      dateLabel: result.dateLabel || dateYmd,
      courts: result.courts,
      bookingUrl: cfg.bookingUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('matchi-slots', venueId, e);
    res.status(500).json({ error: e.message || 'Ukendt fejl' });
  }
}
