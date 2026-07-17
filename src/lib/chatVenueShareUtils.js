import { BANER_VENUES, halbookingOpenVenueUrl } from './banerVenues.js';

export function resolveBanerVenueBookingUrl(venue) {
  if (!venue) return null;
  if (
    venue.kind === 'bookli' ||
    venue.kind === 'link' ||
    venue.kind === 'matchi' ||
    venue.kind === 'playtomic'
  ) {
    return venue.bookingUrl || null;
  }
  if (venue.kind === 'halbooking') {
    const path = halbookingOpenVenueUrl(venue.id);
    if (typeof window !== 'undefined' && window.location?.origin) {
      try {
        return new URL(path, window.location.origin).href;
      } catch {
        return path;
      }
    }
    return path;
  }
  return venue.bookingUrl || null;
}

export function mapBanerVenueToShareableCourt(venue) {
  return {
    id: venue.id,
    name: venue.title,
    city: venue.region,
    address: venue.address,
    booking_url: resolveBanerVenueBookingUrl(venue),
  };
}

export function listShareableCourts(limit = 200) {
  return BANER_VENUES
    .map(mapBanerVenueToShareableCourt)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'da'))
    .slice(0, limit);
}
