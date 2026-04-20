/**
 * GET …?venue=…&date=… — Bookli GraphQL timeline.
 */

import { getBookliVenue } from '../bookliAllowlist.js';
import { fetchBookliTimelineForDate } from '../bookliTimeline.js';
import { DateTime } from 'luxon';
import { checkRateLimit, getClientIp } from '../rateLimit.js';
import { setCorsHeaders } from '../cors.js';

export async function handleBookliSlots(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  setCorsHeaders(req, res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!await checkRateLimit(getClientIp(req), 30, 60_000)) {
    res.status(429).json({ error: 'For mange forespørgsler. Prøv igen om et øjeblik.' });
    return;
  }

  const rawUrl = req.url || '';
  const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const venueId = params.get('venue') || '';
  const dateParam = params.get('date');

  const cfg = getBookliVenue(venueId);
  if (!cfg) {
    res.status(400).json({ error: 'Ukendt Bookli-venue' });
    return;
  }

  const zone = cfg.timezone || 'Europe/Copenhagen';
  const dateYmd =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : DateTime.now().setZone(zone).toISODate();

  try {
    const result = await fetchBookliTimelineForDate(dateYmd, cfg);
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.status(200).json({
      source: 'bookli_graphql',
      venueId,
      ...result,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('bookli-slots', venueId, e);
    res.status(500).json({ error: e.message || 'Ukendt fejl' });
  }
}
