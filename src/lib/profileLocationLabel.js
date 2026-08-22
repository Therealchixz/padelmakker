import { haversineKm, formatApproxKm, parseGeoCoords } from './geoDistance.js';

function profileCoords(profile) {
  if (!profile) return null;
  return parseGeoCoords(profile.latitude, profile.longitude);
}

/** Afstand i km mellem to profiler (null hvis koordinater mangler). */
export function distanceBetweenProfiles(viewer, other) {
  const a = profileCoords(viewer);
  const b = profileCoords(other);
  if (!a || !b) return null;
  return haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
}

/**
 * Lokationslinje til Makkere-kort — fx "Langholt · ca. 12 km".
 * Falder tilbage til region hvis by mangler.
 */
export function formatProfileLocationLine(viewer, other) {
  const city = String(other?.city || '').trim();
  const region = other?.area ? String(other.area).replace(/^Region\s+/i, '').trim() : '';
  const locationPart = city || region;
  if (!locationPart) return null;

  const km = distanceBetweenProfiles(viewer, other);
  const approx = km != null ? formatApproxKm(km) : null;
  const parts = [locationPart];
  if (approx) parts.push(`ca. ${approx}`);
  return parts.join(' · ');
}
