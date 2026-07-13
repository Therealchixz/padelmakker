/**
 * Eksterne kort-links — åbner telefonens kort-app (Google Maps / Apple Maps).
 */

function encodedQuery(address) {
  return encodeURIComponent(String(address || '').trim());
}

/** Søg / vis placering i kort-app. */
export function banerMapsSearchUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodedQuery(address)}`;
}

/** Rutevejledning — foretrækker Apple Maps på iOS, ellers Google Maps. */
export function banerMapsDirectionsUrl(address) {
  const q = encodedQuery(address);
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `https://maps.apple.com/?daddr=${q}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function venueHasMapCoords(venue) {
  const rawLat = venue?.latitude;
  const rawLng = venue?.longitude;
  if (rawLat == null || rawLat === '' || rawLng == null || rawLng === '') return false;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}
