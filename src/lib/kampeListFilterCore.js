/**
 * Lokale liste-filtre til Kampe-fanen (2v2 / turnering / liga).
 * Adskilt fra "Mit kamp-filter" på profilen (notifikationer + søger-synlighed).
 */

import { REGIONS } from './platformConstants.js';
import { BANER_VENUES } from './banerVenues.js';
import { parseMatchLevelRange } from './matchLevelRange.js';

/** Baner-fane landsdele → profil-region (REGIONS). */
const BANER_TO_PROFILE_REGION = {
  Nordjylland: 'Region Nordjylland',
  Vestjylland: 'Region Midtjylland',
  Østjylland: 'Region Midtjylland',
  Sønderjylland: 'Region Syddanmark',
  Fyn: 'Region Syddanmark',
  Sjælland: 'Region Sjælland',
  Hovedstaden: 'Region Hovedstaden',
  Bornholm: 'Region Hovedstaden',
};

function normVenueText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function findBanerVenueByCourtName(courtName) {
  const t = normVenueText(courtName);
  if (!t) return null;
  return (
    BANER_VENUES.find((v) => {
      const vt = normVenueText(v.title);
      return vt === t || vt.includes(t) || t.includes(vt);
    }) ?? null
  );
}

/** Region for et kendt center (Skansen → Region Nordjylland). */
export function resolveVenueProfileRegion(courtName) {
  const venue = findBanerVenueByCourtName(courtName);
  if (!venue?.region) return null;
  const mapped = BANER_TO_PROFILE_REGION[venue.region];
  if (mapped && REGIONS.includes(mapped)) return mapped;
  return canonicalListRegion(venue.region);
}

/** Har kampen/turneringen et valgt sted (ikke «Ikke valgt endnu»)? */
export function entityHasSelectedVenue({ courtName = '', booked = null } = {}) {
  const name = String(courtName || '').trim();
  if (!name || normVenueText(name) === normVenueText('Bane ikke valgt')) return false;
  if (booked === false) return false;
  return true;
}

/**
 * Effektiv region: valgt bane/centers region slår opretterens profil-region.
 * Uden valgt bane → opretterens profil (area).
 */
export function resolveEntityEffectiveRegion({ courtName = '', booked = null, creatorArea = '' } = {}) {
  if (entityHasSelectedVenue({ courtName, booked })) {
    const fromVenue = resolveVenueProfileRegion(courtName);
    if (fromVenue) return fromVenue;
  }
  const fromCreator = canonicalListRegion(creatorArea);
  return REGIONS.includes(fromCreator) ? fromCreator : null;
}

/** Effektiv region for en 2v2-kamp. */
export function resolveMatchEffectiveRegion(match, profilesById = {}) {
  const { booked } = parseMatchLevelRange(match?.level_range);
  const creator = profilesById[String(match?.creator_id)] || {};
  return resolveEntityEffectiveRegion({
    courtName: match?.court_name,
    booked,
    creatorArea: creator?.area,
  });
}

function effectiveRegionMatchesFilter(effectiveRegion, regionId) {
  if (!regionId) return true;
  const target = resolveListRegionId(regionId);
  if (!target) return true;
  if (!effectiveRegion) return false;
  return effectiveRegion === target;
}

/** Gamle by-id'er fra før regions-skift — migreres til kanonisk region. */
const LEGACY_CITY_TO_REGION = {
  kbh: 'Region Hovedstaden',
  aarhus: 'Region Midtjylland',
  odense: 'Region Syddanmark',
  aalborg: 'Region Nordjylland',
};

function canonicalListRegion(stored) {
  const raw = String(stored ?? '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const exact = REGIONS.find((r) => r.toLowerCase() === lower);
  if (exact) return exact;
  for (const r of REGIONS) {
    const tail = r.replace(/^Region\s+/i, '').toLowerCase();
    if (lower === tail || lower.endsWith(tail) || tail.includes(lower) || lower.includes(tail)) {
      return r;
    }
  }
  return raw;
}

export function regionShortLabel(fullRegion) {
  return String(fullRegion || '').replace(/^Region\s+/i, '').trim() || fullRegion;
}

export const KAMPE_LIST_REGION_OPTIONS = [
  { id: '', label: 'Alle' },
  ...REGIONS.map((r) => ({
    id: r,
    label: regionShortLabel(r),
  })),
];

export const KAMPE_LIST_ELO_BANDS = [
  { id: '', label: 'Alle', min: null, max: null },
  { id: '800-1100', label: '800–1100', min: 800, max: 1100 },
  { id: '1100-1300', label: '1100–1300', min: 1100, max: 1300 },
  { id: '1300-1500', label: '1300–1500', min: 1300, max: 1500 },
  { id: '1500+', label: '1500+', min: 1500, max: 3000 },
];

export function defaultKampeListFilter() {
  return { regionId: '', eloBandId: '' };
}

function resolveListRegionId(raw) {
  if (!raw) return '';
  let id = String(raw).trim();
  if (LEGACY_CITY_TO_REGION[id]) id = LEGACY_CITY_TO_REGION[id];
  const canonical = canonicalListRegion(id);
  return REGIONS.includes(canonical) ? canonical : '';
}

export function normalizeKampeListFilter(raw) {
  const base = defaultKampeListFilter();
  if (!raw || typeof raw !== 'object') return base;
  const regionId = resolveListRegionId(raw.regionId);
  const eloBandId = KAMPE_LIST_ELO_BANDS.some((o) => o.id === raw.eloBandId) ? raw.eloBandId : '';
  return { regionId, eloBandId };
}

export function kampeListFilterIsActive(filter) {
  const f = normalizeKampeListFilter(filter);
  return Boolean(f.regionId || f.eloBandId);
}

export function getKampeListRegionLabel(regionId) {
  const canonical = resolveListRegionId(regionId);
  if (!canonical) return '';
  return regionShortLabel(canonical);
}

export function getKampeListEloBandLabel(eloBandId) {
  return KAMPE_LIST_ELO_BANDS.find((o) => o.id === eloBandId)?.label || '';
}

/** Sammenlign profil-region (area) med valgt regionsfilter. */
export function profileAreaMatchesKampeRegionFilter(area, regionId) {
  if (!regionId) return true;
  const target = resolveListRegionId(regionId);
  if (!target) return true;
  const fromProfile = canonicalListRegion(area);
  if (!fromProfile || !REGIONS.includes(fromProfile)) return false;
  return fromProfile === target;
}

function eloRangesOverlap(aMin, aMax, bMin, bMax) {
  if (aMin == null || aMax == null || bMin == null || bMax == null) return true;
  return aMin <= bMax && bMin <= aMax;
}

/** 2v2-kamp: overlap mellem kampens ELO-interval og valgt bånd. */
export function matchPassesKampeEloBandFilter(match, eloBandId) {
  if (!eloBandId) return true;
  const band = KAMPE_LIST_ELO_BANDS.find((o) => o.id === eloBandId);
  if (!band || band.min == null) return true;
  const { min, max } = parseMatchLevelRange(match?.level_range);
  if (min == null || max == null) return true;
  return eloRangesOverlap(min, max, band.min, band.max);
}

/** 2v2-kamp: bane-region slår opretter-region; uden bane → opretterens profil. */
export function matchPassesKampeRegionFilter(match, regionId, profilesById = {}) {
  if (!regionId) return true;
  const effective = resolveMatchEffectiveRegion(match, profilesById);
  return effectiveRegionMatchesFilter(effective, regionId);
}

export function matchPassesKampeListFilter(match, filter, { profilesById } = {}) {
  const f = normalizeKampeListFilter(filter);
  if (!matchPassesKampeRegionFilter(match, f.regionId, profilesById)) return false;
  if (!matchPassesKampeEloBandFilter(match, f.eloBandId)) return false;
  return true;
}

/** Turnering/liga: bane-region slår opretter-region; uden bane → opretterens profil. */
export function tournamentPassesKampeRegionFilter(
  _tournament,
  regionId,
  creatorArea = '',
  courtName = '',
) {
  if (!regionId) return true;
  const effective = resolveEntityEffectiveRegion({
    courtName,
    booked: entityHasSelectedVenue({ courtName }) ? true : false,
    creatorArea,
  });
  return effectiveRegionMatchesFilter(effective, regionId);
}
