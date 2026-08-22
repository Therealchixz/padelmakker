/**
 * Parse GPS-koordinater. `Number(null) === 0` i JS, så null/undefined
 * må ikke behandles som Null Island (0, 0) — det er ~6400 km fra Danmark.
 */
export function parseGeoCoords(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  /* (0, 0) i Atlanterhavet — typisk default/manglende data, ikke en rigtig by. */
  if (Math.abs(latitude) < 0.01 && Math.abs(longitude) < 0.01) return null;
  return { latitude, longitude };
}

/** Afstand mellem to koordinater (km) — Haversine. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const a = parseGeoCoords(lat1, lon1);
  const b = parseGeoCoords(lat2, lon2);
  if (!a || !b) return null;

  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Afrundet afstand til visning — fx "12 km", "ca. 850 m". */
export function formatApproxKm(km) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n < 1) {
    const m = Math.max(100, Math.round(n * 1000 / 50) * 50);
    return `${m} m`;
  }
  if (n < 10) return `${Math.round(n)} km`;
  return `${Math.round(n / 5) * 5} km`;
}
