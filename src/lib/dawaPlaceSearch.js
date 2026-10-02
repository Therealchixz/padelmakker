import { parseGeoCoords } from './geoDistance.js';

/*
 * Bysøgning og bynavn → placering.
 *
 * Før slog vi op i DAWA (api.dataforsyningen.dk). Den tjeneste lukkede
 * 1. okt. 2026 og svarer nu "410 Gone", så ingen kunne vælge by ved oprettelse
 * (ejeren 2. okt. 2026: Jakob kunne ikke blive færdig). Nu ligger listen over
 * danske byer og postnumre i appen selv (dkPlacesData.js) og hentes først, når
 * der faktisk søges — ingen ekstern tjeneste, der kan lukke igen.
 * Navnene på funktionerne er beholdt, så resten af appen ikke skal ændres.
 */

const POSTAL_RANK = 1.5; // postby (fx "8000 Aarhus C") efter rigtige byer, før landsbyer

let indexPromise = null;

/** Små/store bogstaver, å/aa, æ/ae, ø/oe og accenter tæller ens. */
export function normalizePlaceName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^kgs\.?\s*/, 'kongens ')
    .replace(/å/g, 'aa')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Løsere nøgle, så "Ronne" finder Rønne og "Arhus" finder Århus. */
function looseKey(normalized) {
  return normalized.replace(/aa/g, 'a').replace(/ae/g, 'a').replace(/oe/g, 'o');
}

function buildIndex({ DK_TOWNS, DK_PLACES, DK_POSTAL }) {
  const places = DK_PLACES.map(([name, lat, lon, rank, pop, near], i) => {
    const key = normalizePlaceName(name);
    return {
      i,
      name,
      lat,
      lon,
      rank,
      pop,
      near: near >= 0 ? DK_TOWNS[near] : '',
      key,
      loose: looseKey(key),
      words: key.split(/[\s-]+/),
    };
  });
  const postal = DK_POSTAL.map(([nr, by, lat, lon]) => {
    const key = normalizePlaceName(by);
    return { nr, by, lat, lon, rank: POSTAL_RANK, pop: 0, key, loose: looseKey(key) };
  });
  return { places, postal };
}

function loadIndex() {
  if (!indexPromise) {
    indexPromise = import('./dkPlacesData.js').then(buildIndex).catch((err) => {
      indexPromise = null;
      throw err;
    });
  }
  return indexPromise;
}

function placeResult(p) {
  // Landsbyer får nærmeste by med, så fx de mange "Svenstrup" kan skelnes.
  const label = p.rank >= 2 && p.near ? `${p.name}, ved ${p.near}` : p.name;
  return {
    id: `sted-${p.i}`,
    label,
    city: p.name,
    latitude: p.lat,
    longitude: p.lon,
    source: 'stednavn',
    rank: p.rank,
  };
}

function postalResult(z) {
  return {
    id: `postnr-${z.nr}`,
    label: `${z.nr} ${z.by}`,
    city: z.by,
    latitude: z.lat,
    longitude: z.lon,
    source: 'postnummer',
    rank: z.rank,
  };
}

function normalizeQuery(q) {
  return String(q || '').trim();
}

/** Postnummer-søgning (9310, 9400). */
function isPostnummerQuery(q) {
  return /^\d{2,4}$/.test(normalizeQuery(q));
}

function matchScore(entry, nq, lq) {
  if (entry.key === nq || entry.loose === lq) return 0;
  if (entry.key.startsWith(nq) || entry.loose.startsWith(lq)) return 1;
  if (entry.words && entry.words.some((w) => w.startsWith(nq) || looseKey(w).startsWith(lq))) return 2;
  return -1;
}

/** Byer og købstæder først (Kongens Lyngby før landsbyen Lyngby), så bedste navne-match. */
function byBest(a, b) {
  const tierA = a.entry.rank <= 1 ? 0 : 1;
  const tierB = b.entry.rank <= 1 ? 0 : 1;
  return (
    tierA - tierB ||
    a.score - b.score ||
    a.entry.rank - b.entry.rank ||
    b.entry.pop - a.entry.pop ||
    String(a.entry.name || a.entry.by).localeCompare(String(b.entry.name || b.entry.by), 'da')
  );
}

function sameSpot(a, b) {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.015;
}

/**
 * Søg danske byer, landsbyer, bydele og postnumre.
 * Returnerer { city, latitude, longitude, label, id, source }[].
 */
export async function searchDawaPlaces(query, { limit = 8 } = {}) {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];
  const { places, postal } = await loadIndex();

  if (isPostnummerQuery(q)) {
    return postal
      .filter((z) => z.nr.startsWith(q))
      .sort((a, b) => a.nr.localeCompare(b.nr))
      .slice(0, limit)
      .map(postalResult);
  }

  const nq = normalizePlaceName(q);
  const lq = looseKey(nq);
  const hits = [];
  for (const p of places) {
    const score = matchScore(p, nq, lq);
    if (score >= 0) hits.push({ score, entry: p, kind: 'place' });
  }
  const postalNames = new Set();
  for (const z of postal) {
    const score = matchScore(z, nq, lq);
    if (score < 0 || score > 1) continue;
    // København K har mange postnumre — vis navnet én gang.
    if (postalNames.has(z.key)) continue;
    // "6600 Vejen" ligger oven i byen Vejen — vis kun byen én gang.
    if (hits.some((h) => h.kind === 'place' && h.entry.key === z.key && sameSpot(h.entry, z))) continue;
    postalNames.add(z.key);
    hits.push({ score, entry: z, kind: 'postal' });
  }
  hits.sort(byBest);
  return hits.slice(0, limit).map((h) => (h.kind === 'postal' ? postalResult(h.entry) : placeResult(h.entry)));
}

/** Er by valgt med gyldige koordinater? */
export function isValidCityPlace(place) {
  if (!place || typeof place !== 'object') return false;
  const city = String(place.city || '').trim();
  // Number(null) === 0 — må ikke tælle som gyldig placering.
  return city.length > 0 && Boolean(parseGeoCoords(place.latitude, place.longitude));
}

/** Bynavn gemt uden koordinater — km kan ikke vises før byen er valgt fra listen. */
export function hasIncompleteCityProfile(profile) {
  if (!profile) return false;
  if (isValidCityPlace(profile)) return false;
  return String(profile.city || '').trim().length > 0;
}

/** Kandidater til opslag (fx "Aarhus, Hadsten" → Aarhus + Hadsten). */
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

/** Behold søgenavnet som by, når fundet er et længere navn (fx København → København K). */
function preferDisplayCity(place, query) {
  if (!place) return null;
  const q = normalizeQuery(query);
  if (!q) return place;
  const city = String(place.city || '');
  if (normalizePlaceName(city).startsWith(normalizePlaceName(q)) && q.length >= 4 && city.length > q.length) {
    return { ...place, city: q, label: q };
  }
  return place;
}

function bestOf(entries) {
  return [...entries].sort((a, b) => a.rank - b.rank || b.pop - a.pop)[0] || null;
}

/**
 * Slå et gemt bynavn op (når kun bynavnet er gemt, uden placering).
 * Foretrækker præcist navn og den største by med det navn.
 */
export async function resolveCityPlaceFromName(name) {
  const candidates = cityNameCandidates(name);
  if (!candidates.length) return null;
  const { places, postal } = await loadIndex();

  for (const q of candidates) {
    const nq = normalizePlaceName(q);

    const exactPlace = bestOf(places.filter((p) => p.key === nq));
    if (exactPlace && exactPlace.rank <= 2) return placeResult(exactPlace);
    const exactPostal = postal.find((z) => z.key === nq);
    if (exactPostal) return postalResult(exactPostal);
    if (exactPlace) return placeResult(exactPlace);

    // Prefix: "København" → "København K".
    const prefix = bestOf([
      ...places.filter((p) => p.key.startsWith(nq)),
      ...postal.filter((z) => z.key.startsWith(nq)),
    ]);
    if (prefix) {
      return preferDisplayCity(prefix.by ? postalResult(prefix) : placeResult(prefix), q);
    }

    // Løsere match kun når der er ét kandidatnavn — ellers prøv næste kandidat.
    if (candidates.length === 1) {
      const loose = bestOf(places.filter((p) => p.words.some((w) => w.startsWith(nq))));
      if (loose) return placeResult(loose);
    }
  }

  return null;
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
export async function attachResolvedCityCoords(profiles) {
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
        cache.set(key, await resolveCityPlaceFromName(city));
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
