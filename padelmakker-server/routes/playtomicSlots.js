/**
 * GET …?venue=…&date=… — Playtomic ledige tider (web-BFF).
 */

import { DateTime } from 'luxon';
import { getPlaytomicVenue, playtomicClubDeepUrl } from '../playtomicAllowlist.js';
import { fetchPlaytomicSchedule } from '../playtomicSchedule.js';
import { checkRateLimit, getClientIp } from '../rateLimit.js';
import { setCorsHeaders } from '../cors.js';

export async function handlePlaytomicSlots(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  setCorsHeaders(req, res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!(await checkRateLimit(getClientIp(req) + ':baner', 60, 60_000))) {
    res.status(429).json({ error: 'For mange forespørgsler. Prøv igen om et øjeblik.' });
    return;
  }

  const rawUrl = req.url || '';
  const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const venueId = params.get('venue') || '';
  const dateParam = params.get('date');

  const cfg = getPlaytomicVenue(venueId);
  if (!cfg) {
    res.status(400).json({ error: 'Ukendt Playtomic-venue' });
    return;
  }

  const dateYmd =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : DateTime.now().setZone('Europe/Copenhagen').toISODate();

  try {
    const result = await fetchPlaytomicSchedule(cfg, dateYmd);
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.status(200).json({
      source: 'playtomic_web_bff',
      venueId,
      date: dateYmd,
      scheduleDate: result.scheduleDate || dateYmd,
      dateLabel: result.dateLabel || dateYmd,
      courts: result.courts,
      bookingUrl: playtomicClubDeepUrl(cfg, dateYmd),
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('playtomic-slots', venueId, e);
    res.status(500).json({ error: e.message || 'Ukendt fejl' });
  }
}
