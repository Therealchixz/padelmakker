import { parseGeoCoords } from './geoDistance.js';

const STEDNAVNE_URL = 'https://api.dataforsyningen.dk/stednavne/autocomplete';
const POSTNUMRE_URL = 'https://api.dataforsyningen.dk/postnumre/autocomplete';

/** Kræver https://api.dataforsyningen.dk i CSP connect-src (vercel.json) på produktion. */

function normalizeQuery(q) {
  return String(q || '').trim();
}

/** Postnummer-søgning (9310, 9400) — stednavne med fuzzy giver støj (fx "10, Aabenraa"). */
function isPostnummerQuery(q) {
  return /^\d{2,4}$/.test(normalizeQuery(q));
}

function kommuneLabel(item) {
  const k = item?.kommuner?.[0]?.navn;
  return k ? String(k).trim() : '';
}

function mapStednavn(item) {
  const hovedtype = String(item?.hovedtype || '').trim();
  if (hovedtype !== 'Bebyggelse') return null;

  const center = item?.visueltcenter;
  if (!Array.isArray(center) || center.length < 2) return null;
  const city = String(item?.navn || '').trim();
  if (!city) return null;
  const kommune = kommuneLabel(item);
  const label = kommune ? `${city}, ${kommune}` : city;
  return {
    id: String(item.id || item.href || label),
    label,
    city,
    latitude: Number(center[1]),
    longitude: Number(center[0]),
    source: 'stednavn',
    rank: 0,
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
    rank: 0,
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
  const postnummerMode = isPostnummerQuery(q);

  const postPromise = fetchImpl(`${POSTNUMRE_URL}?q=${enc}`, { headers: { Accept: 'application/json' } }).then((r) => {
    if (!r.ok) throw new Error(`DAWA postnumre ${r.status}`);
    return r.json();
  });

  const stedPromise = postnummerMode
    ? Promise.resolve([])
    : fetchImpl(`${STEDNAVNE_URL}?q=${enc}&fuzzy=`, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) throw new Error(`DAWA stednavne ${r.status}`);
      return r.json();
    });

  const [stedRaw, postRaw] = await Promise.all([stedPromise, postPromise]);

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
  // Number(null) === 0 — må ikke tælle som gyldig placering.
  return city.length > 0 && Boolean(parseGeoCoords(place.latitude, place.longitude));
}

/** Bynavn gemt uden koordinater — km kan ikke vises før DAWA-valg. */
export function hasIncompleteCityProfile(profile) {
  if (!profile) return false;
  if (isValidCityPlace(profile)) return false;
  return String(profile.city || '').trim().length > 0;
}

/** Kandidater til DAWA-opslag (fx "Aarhus, Hadsten" → Aarhus + Hadsten). */
export function cityNameCandidates(name) {
  const raw = normalizeQuery(name);
  if (!raw) return [];
  const parts = raw.split(/[,;/|]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
  const out = [];
  const push = (s) => {
    const t = normalizeQuery(s);
    if (t.length < 2) return;
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  push(raw);
  for (const p of parts) push(p);
  for (const p of [...out]) {
    push(p.replace(/^Århus$/i, 'Aarhus'));
    push(p.replace(/^København\s+S$/i, 'København'));
  }
  return out;
}

/**
 * Slå eksisterende bynavn op i DAWA (backfill når kun city-tekst er gemt).
 * Foretrækker præcis bynavn-match og bebyggelse frem for postnummer.
 */
export async function resolveCityPlaceFromName(name, { fetchImpl = fetch } = {}) {
  const candidates = cityNameCandidates(name);
  if (!candidates.length) return null;

  for (const q of candidates) {
    const places = await searchDawaPlaces(q, { limit: 12, fetchImpl });
    if (!places.length) continue;

    const qLower = q.toLowerCase();
    const exactCity = places.filter((p) => p.city.toLowerCase() === qLower);
    if (exactCity.length) {
      // Postnummer-centrum er mere pålideligt end små bebyggelser med samme navn.
      const post = exactCity.find((p) => p.source === 'postnummer');
      if (post) return preferDisplayCity(post, q);
      const mainTown = exactCity.find((p) => {
        const label = String(p.label || '').toLowerCase();
        return label === `${qLower}, ${qLower}` || label.startsWith(`${qLower}, ${qLower}`);
      });
      if (mainTown) return preferDisplayCity(mainTown, q);
      return preferDisplayCity(exactCity[0], q);
    }

    // Prefix-match: "København" → "København K" (postdistrikt).
    const prefixCity = places.filter((p) => p.city.toLowerCase().startsWith(qLower));
    if (prefixCity.length) {
      const post = prefixCity.find((p) => p.source === 'postnummer');
      return preferDisplayCity(post || prefixCity[0], q);
    }

    // Kun fuzzy fallback når der kun er ét kandidatnavn — ellers prøv næste kandidat.
    if (candidates.length === 1) {
      const labelStarts = places.filter((p) => p.label.toLowerCase().startsWith(qLower));
      if (labelStarts.length) return preferDisplayCity(labelStarts[0], q);
      return preferDisplayCity(places[0], q);
    }
  }

  return null;
}

/** Behold søgenavn som by når DAWA returnerer distrikt (fx København → København K). */
function preferDisplayCity(place, query) {
  if (!place) return null;
  const q = normalizeQuery(query);
  if (!q) return place;
  const city = String(place.city || '');
  if (city.toLowerCase().startsWith(q.toLowerCase()) && q.length >= 4 && city.length > q.length) {
    return { ...place, city: q, label: q };
  }
  return place;
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

/**
 * Tilføj lat/lng på profiler der kun har bynavn, så Makkere kan vise ca. km.
 * Skriver ikke til databasen — kun visning/matchmaking i klienten.
 */
export async function attachResolvedCityCoords(profiles, { fetchImpl = fetch } = {}) {
  const list = Array.isArray(profiles) ? profiles : [];
  const cache = new Map();
  const out = [];
  for (const profile of list) {
    if (isValidCityPlace(profile)) {
      out.push(profile);
      continue;
    }
    const city = String(profile?.city || '').trim();
    if (!city) {
      out.push(profile);
      continue;
    }
    const key = city.toLowerCase();
    if (!cache.has(key)) {
      try {
        cache.set(key, await resolveCityPlaceFromName(city, { fetchImpl }));
      } catch {
        cache.set(key, null);
      }
    }
    const place = cache.get(key);
    if (place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
      out.push({ ...profile, latitude: place.latitude, longitude: place.longitude });
    } else {
      out.push(profile);
    }
  }
  return out;
}
