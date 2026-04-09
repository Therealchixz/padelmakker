/**
 * GET /api/bookli-slots?venue=padelpadel_aalborg&date=2026-04-08
 * Offentlig Bookli GraphQL (samme data som PadelPadel iframe) — ingen login.
 */

import { getBookliVenue } from './lib/bookliAllowlist.js';
import { fetchBookliTimelineForDate } from './lib/bookliTimeline.js';
import { DateTime } from 'luxon';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
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
