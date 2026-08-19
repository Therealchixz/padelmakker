import { haversineKm, formatApproxKm } from './geoDistance.js';

function profileCoords(profile) {
  if (!profile) return null;
  const latitude = profile.latitude != null ? Number(profile.latitude) : NaN;
  const longitude = profile.longitude != null ? Number(profile.longitude) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
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
