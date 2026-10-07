/**
 * Fælles regionsliste i hele appen — samme landsdele som under Baner og bane-vælger.
 */

import { BANER_REGION_ORDER, BANER_REGION_SUBTITLE } from './banerRegions.js';

export const APP_REGIONS = [...BANER_REGION_ORDER];
export { BANER_REGION_SUBTITLE };
export const DEFAULT_APP_REGION = 'Hovedstaden';

/**
 * Gamle profil-værdier (5 administrative regioner + bynavn) → app-landsdele.
 * Skal holdes i sync med public.canonical_app_region() i Supabase.
 */
export const LEGACY_ADMIN_REGION_TO_APP = {
  'Region Nordjylland': 'Nordjylland',
  'Region Hovedstaden': 'Hovedstaden',
  'Region Sjælland': 'Sjælland',
  'Region Syddanmark': 'Sydjylland',
  Sønderjylland: 'Sydjylland',
  'Region Midtjylland': 'Østjylland',
  København: 'Hovedstaden',
};

/**
 * Nabo-regioner. Skal holdes i sync med public.app_region_neighbours() i
 * Supabase. Beskeder om nye kampe og makkere bruger dem ikke længere (de går
 * til spillere inden for 50 km, se notifyReachLabel).
 */
export const APP_REGION_NEIGHBOURS = {
  Nordjylland: ['Vestjylland', 'Østjylland'],
  Vestjylland: ['Nordjylland', 'Østjylland', 'Sydjylland'],
  Østjylland: ['Nordjylland', 'Vestjylland', 'Sydjylland', 'Fyn'],
  Sydjylland: ['Vestjylland', 'Østjylland', 'Fyn'],
  Fyn: ['Østjylland', 'Sydjylland', 'Sjælland'],
  Sjælland: ['Fyn', 'Hovedstaden'],
  Hovedstaden: ['Sjælland'],
  Bornholm: [],
};

/** Gamle by-id'er fra filter-UI → app-landsdele. */
export const LEGACY_CITY_ID_TO_APP_REGION = {
  kbh: 'Hovedstaden',
  aarhus: 'Østjylland',
  odense: 'Fyn',
  aalborg: 'Nordjylland',
};

/** Normalisér gemt region til en kanonisk app-landsdel. */
export function canonicalAppRegion(stored) {
  const raw = String(stored ?? '').trim();
  if (!raw) return '';
  if (APP_REGIONS.includes(raw)) return raw;

  const legacyAdmin = LEGACY_ADMIN_REGION_TO_APP[raw];
  if (legacyAdmin) return legacyAdmin;

  const lower = raw.toLowerCase();
  const exact = APP_REGIONS.find((r) => r.toLowerCase() === lower);
  if (exact) return exact;

  for (const [admin, appRegion] of Object.entries(LEGACY_ADMIN_REGION_TO_APP)) {
    if (admin.toLowerCase() === lower) return appRegion;
  }

  for (const r of APP_REGIONS) {
    const rl = r.toLowerCase();
    if (lower === rl || lower.endsWith(rl) || rl.includes(lower) || lower.includes(rl)) {
      return r;
    }
  }

  return raw;
}

export function isValidAppRegion(area) {
  return APP_REGIONS.includes(canonicalAppRegion(area));
}

export function regionDisplayLabel(region) {
  return String(region || '').replace(/^Region\s+/i, '').trim() || region;
}

/** Afstanden beskeder om nye makkere og kampe når ud (public.notify_within_reach). */
export const NOTIFY_REACH_KM = 50;

/**
 * Hvem man får besked om med den valgte landsdel i filteret — samme regel som
 * public.notify_within_reach i databasen (ejeren 7. okt. 2026):
 * egen landsdel + kendt by → inden for 50 km; ellers hele den valgte landsdel.
 */
export function notifyReachLabel(selectedRegion, profile) {
  const selected = canonicalAppRegion(selectedRegion);
  const home = canonicalAppRegion(profile?.area);
  const lat = Number(profile?.latitude);
  const lng = Number(profile?.longitude);
  const hasCity = profile?.latitude != null && profile?.longitude != null
    && Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01);
  if (!selected) return '';
  if (hasCity && (!home || selected === home)) {
    const city = String(profile?.city || '').trim();
    return `Besked om spillere inden for ca. ${NOTIFY_REACH_KM} km${city ? ` af ${city}` : ''}`;
  }
  return `Besked om spillere i ${selected}`;
}
