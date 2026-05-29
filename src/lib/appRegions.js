/**
 * Fælles regionsliste i hele appen — samme landsdele som under Baner og bane-vælger.
 */

import { BANER_REGION_ORDER, BANER_REGION_SUBTITLE } from './banerRegions.js';

export const APP_REGIONS = [...BANER_REGION_ORDER];
export { BANER_REGION_SUBTITLE };
export const DEFAULT_APP_REGION = 'Hovedstaden';

/** Gamle profil-værdier (5 administrative regioner) → app-landsdele. */
export const LEGACY_ADMIN_REGION_TO_APP = {
  'Region Nordjylland': 'Nordjylland',
  'Region Hovedstaden': 'Hovedstaden',
  'Region Sjælland': 'Sjælland',
  'Region Syddanmark': 'Sydjylland',
  Sønderjylland: 'Sydjylland',
  'Region Midtjylland': 'Østjylland',
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
