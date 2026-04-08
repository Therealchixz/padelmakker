/**
 * GET /api/halbooking-slots?venue=skansen_ntsc
 * Generisk ledige tider for allowlisted Halbooking-venues.
 */

import { fetchHalbookingPadelSchedule } from './lib/halbookingFetch.js';
import { getAllowlistedVenue } from './lib/halbookingVenuesAllowlist.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawUrl = req.url || '';
  const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const venueId = params.get('venue') || '';

  const venue = getAllowlistedVenue(venueId);
  if (!venue) {
    res.status(400).json({ error: 'Ukendt eller manglende venue' });
    return;
  }

  try {
    const result = await fetchHalbookingPadelSchedule(venue.procBaner, venue.omraede);
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.status(200).json({
      venueId,
      dateLabel: result.dateLabel,
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
