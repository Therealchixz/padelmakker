/** Afstand mellem to koordinater (km) — Haversine. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || v === '' || !Number.isFinite(Number(v)))) {
    return null;
  }
  const a1 = Number(lat1);
  const o1 = Number(lon1);
  const a2 = Number(lat2);
  const o2 = Number(lon2);

  const R = 6371;
  const dLat = ((a2 - a1) * Math.PI) / 180;
  const dLon = ((o2 - o1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a1 * Math.PI) / 180) *
      Math.cos((a2 * Math.PI) / 180) *
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
