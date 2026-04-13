/**
 * GET — bagudkompatibilitet: samme som venue=skansen_ntsc
 */

import { fetchHalbookingPadelSchedule } from '../halbookingFetch.js';
import { getAllowlistedVenue } from '../halbookingVenuesAllowlist.js';
import { setJsonCors } from '../cors.js';

export async function handleHalbookingSkansenLegacy(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  setJsonCors(req, res);

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const venue = getAllowlistedVenue('skansen_ntsc');
  if (!venue) {
    res.status(500).json({ error: 'Venue skansen_ntsc mangler i allowlist' });
    return;
  }
  try {
    const result = await fetchHalbookingPadelSchedule(venue.procBaner, venue.omraede);
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }

    res.status(200).json({
      venueId: 'skansen_ntsc',
      source: 'ntsc_halbooking',
      area: 'padel_skansen',
      dateLabel: result.dateLabel,
      fetchedAt: new Date().toISOString(),
      bookingBaseUrl: result.procBaner,
      bookingUrl: '/api/halbooking-open-padel?venue=skansen_ntsc',
      openBookingPath: '/api/halbooking-open-padel?venue=skansen_ntsc',
      courts: result.courts,
    });
  } catch (e) {
    console.error('halbooking-skansen-padel', e);
    res.status(500).json({ error: e.message || 'Ukendt fejl' });
  }
}
