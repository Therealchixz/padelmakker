/**
 * GET …?venue=…&date=… — generisk Halbooking kalender.
 */

import { fetchHalbookingPadelSchedule, parseScheduleDateYmd } from '../halbookingFetch.js';
import { getAllowlistedVenue } from '../halbookingVenuesAllowlist.js';
import { checkRateLimit, getClientIp } from '../rateLimit.js';
import { setJsonCors } from '../cors.js';

export async function handleHalbookingSlots(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  setJsonCors(req, res);

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
  const dateYmd =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(String(dateParam).trim()) ? String(dateParam).trim() : null;

  const venue = getAllowlistedVenue(venueId);
  if (!venue) {
    res.status(400).json({ error: 'Ukendt eller manglende venue' });
    return;
  }

  try {
    const result = await fetchHalbookingPadelSchedule(venue.procBaner, venue.omraede, {
      ...(dateYmd ? { targetDateYmd: dateYmd } : {}),
    });
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.status(200).json({
      venueId,
      dateLabel: result.dateLabel,
      scheduleDate: parseScheduleDateYmd(result.dateLabel || ''),
      fetchedAt: new Date().toISOString(),
      bookingBaseUrl: result.procBaner,
      openBookingPath: `/api/halbooking-open-padel?venue=${encodeURIComponent(venueId)}`,
      courts: result.courts,
    });
  } catch (e) {
    console.error('halbooking-slots', venueId, e);
    res.status(500).json({ error: e.message || 'Ukendt fejl' });
  }
}
