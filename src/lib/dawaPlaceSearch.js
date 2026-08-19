const STEDNAVNE_URL = 'https://api.dataforsyningen.dk/stednavne/autocomplete';
const POSTNUMRE_URL = 'https://api.dataforsyningen.dk/postnumre/autocomplete';

/** Kræver https://api.dataforsyningen.dk i CSP connect-src (vercel.json) på produktion. */

const BEBYGGERLSE_TYPES = new Set(['by', 'bydel', 'forstad', 'landsby', 'sommerhusområde', 'sommerhusomraade']);

function normalizeQuery(q) {
  return String(q || '').trim();
}

function kommuneLabel(item) {
  const k = item?.kommuner?.[0]?.navn;
  return k ? String(k).trim() : '';
}

function mapStednavn(item) {
  const center = item?.visueltcenter;
  if (!Array.isArray(center) || center.length < 2) return null;
  const city = String(item?.navn || '').trim();
  if (!city) return null;
  const kommune = kommuneLabel(item);
  const label = kommune ? `${city}, ${kommune}` : city;
  const undertype = String(item?.undertype || '').toLowerCase();
  const hovedtype = String(item?.hovedtype || '').trim();
  const isBebyggelse = hovedtype === 'Bebyggelse' || BEBYGGERLSE_TYPES.has(undertype);
  return {
    id: String(item.id || item.href || label),
    label,
    city,
    latitude: Number(center[1]),
    longitude: Number(center[0]),
    source: 'stednavn',
    rank: isBebyggelse ? 0 : hovedtype === 'Bebyggelse' ? 1 : 2,
  };
}

function mapPostnummer(item) {
  const pn = item?.postnummer;
  if (!pn) return null;
  const lat = Number(pn.visueltcenter_y);
  const lng = Number(pn.visueltcenter_x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const city = String(pn.navn || '').trim();
  const nr = String(pn.nr || '').trim();
  const label = String(item.tekst || (nr && city ? `${nr} ${city}` : city || nr)).trim();
  if (!label) return null;
  return {
    id: `postnr-${nr || label}`,
    label,
    city: city || label,
    latitude: lat,
    longitude: lng,
    source: 'postnummer',
    rank: 1,
  };
}

function dedupePlaces(places) {
  const seen = new Set();
  const out = [];
  for (const p of places) {
    if (!p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
    const key = `${p.city.toLowerCase()}|${p.latitude.toFixed(3)}|${p.longitude.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DAWA ${res.status}`);
  return res.json();
}

/**
 * Søg danske steder via DAWA (stednavne + postnumre).
 * Returnerer { city, latitude, longitude, label, id, source }[].
 */
export async function searchDawaPlaces(query, { limit = 8, fetchImpl = fetch } = {}) {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];

  const enc = encodeURIComponent(q);
  const [stedRaw, postRaw] = await Promise.all([
    fetchImpl(`${STEDNAVNE_URL}?q=${enc}&fuzzy=`, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) throw new Error(`DAWA stednavne ${r.status}`);
      return r.json();
    }),
    fetchImpl(`${POSTNUMRE_URL}?q=${enc}`, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) throw new Error(`DAWA postnumre ${r.status}`);
      return r.json();
    }),
  ]);

  const mapped = [
    ...(Array.isArray(stedRaw) ? stedRaw.map(mapStednavn).filter(Boolean) : []),
    ...(Array.isArray(postRaw) ? postRaw.map(mapPostnummer).filter(Boolean) : []),
  ];

  return dedupePlaces(mapped)
    .sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9) || a.label.localeCompare(b.label, 'da'))
    .slice(0, limit);
}

/** Er by valgt med gyldige koordinater fra DAWA? */
export function isValidCityPlace(place) {
  if (!place || typeof place !== 'object') return false;
  const city = String(place.city || '').trim();
  return city.length > 0 && Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude));
}

/** Byg place-objekt fra profil-række (onboarding/profil). */
export function cityPlaceFromProfile(profile) {
  if (!profile) return null;
  const city = String(profile.city || '').trim();
  const latitude = profile.latitude != null ? Number(profile.latitude) : NaN;
  const longitude = profile.longitude != null ? Number(profile.longitude) : NaN;
  if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { id: `profile-${city}`, label: city, city, latitude, longitude, source: 'profile' };
}
