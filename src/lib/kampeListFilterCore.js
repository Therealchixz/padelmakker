/**
 * Lokale liste-filtre til Kampe-fanen (2v2 / turnering / liga).
 * Adskilt fra "Mit kamp-filter" på profilen (notifikationer + søger-synlighed).
 */

import { REGIONS } from './platformConstants.js';
import { BANER_VENUES } from './banerVenues.js';
import { parseMatchLevelRange } from './matchLevelRange.js';
import { clampPlaytomicLevel, eloRangeToLevelRange, levelRangeForWindow, formatPlaytomicLevel } from './padelLevelUtils.js';
import {
  canonicalAppRegion,
  LEGACY_CITY_ID_TO_APP_REGION,
  regionDisplayLabel,
} from './appRegions.js';

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

/** Region for et kendt center (Skansen → Nordjylland). */
export function resolveVenueProfileRegion(courtName) {
  const venue = findBanerVenueByCourtName(courtName);
  if (!venue?.region) return null;
  return canonicalAppRegion(venue.region);
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

/**
 * Søgestreng til ekstern rutevejledning (Google/Apple Maps).
 * Bruger banens adresse fra Baner-kataloget når vi kender centret.
 */
export function resolveEntityDirectionsQuery({ courtName = '', booked = null } = {}) {
  if (!entityHasSelectedVenue({ courtName, booked })) return null;

  const venue = findBanerVenueByCourtName(courtName);
  const address = String(venue?.address || '').trim();
  if (address && !/se booking/i.test(address) && /\d/.test(address)) {
    return /denmark/i.test(address) ? address : `${address}, Denmark`;
  }

  const name = String(courtName || '').trim();
  if (!name || normVenueText(name) === normVenueText('Bane ikke valgt')) return null;
  return `${name}, Denmark`;
}

/** @param {object} match @param {Record<string, object>} [_profilesById] reserveret, bruges ikke */
export function resolveMatchDirectionsQuery(match, _profilesById = {}) {
  const { booked } = parseMatchLevelRange(match?.level_range);
  return resolveEntityDirectionsQuery({
    courtName: match?.court_name,
    booked,
  });
}

/** Turnering med valgt bane (Americano/Mexicano). */
export function resolveCourtNameDirectionsQuery(courtName) {
  const name = String(courtName || '').trim();
  if (!name || normVenueText(name) === normVenueText('Bane ikke valgt')) return null;
  return resolveEntityDirectionsQuery({ courtName: name, booked: true });
}

function effectiveRegionMatchesFilter(effectiveRegion, regionId) {
  if (!regionId) return true;
  const target = resolveListRegionId(regionId);
  if (!target) return true;
  if (!effectiveRegion) return false;
  return effectiveRegion === target;
}

/** Gamle by-id'er fra før regions-skift — migreres til kanonisk landsdel. */
const LEGACY_CITY_TO_REGION = LEGACY_CITY_ID_TO_APP_REGION;

function canonicalListRegion(stored) {
  return canonicalAppRegion(stored);
}

export function regionShortLabel(fullRegion) {
  return regionDisplayLabel(fullRegion);
}

export const KAMPE_LIST_REGION_OPTIONS = [
  { id: '', label: 'Alle' },
  ...REGIONS.map((r) => ({
    id: r,
    label: regionShortLabel(r),
  })),
];

/**
 * Niveau-spænd omkring brugerens eget niveau (profilen). Før var det ±ELO om
 * brugerens rating, men kampens niveau er valgt i niveau og kun gemt som ELO
 * (fast omregning). ELO stiger med kampe, niveau sætter man selv, så en
 * spiller med ELO 1075 og niveau 3,5 fik sine egne 3,2–3,5-kampe sorteret fra.
 * Id'erne er de samme som før, så gemte filtre virker.
 */
export const KAMPE_LIST_ELO_BANDS = [
  { id: '', label: 'Alle', delta: null },
  { id: 'tight', label: 'Tæt på mit niveau (±0,5)', delta: 0.5 },
  { id: 'flex', label: 'Lidt bredere (±1,0)', delta: 1 },
  { id: 'open', label: 'Bredt (±2,0)', delta: 2 },
];

const LEGACY_ELO_BAND_IDS = new Set(['800-1100', '1100-1300', '1300-1500', '1500+']);

/** Niveau-interval omkring brugerens eget niveau. */
export function kampeLevelFilterRangeFromUser(eloBandId, userLevel) {
  const band = KAMPE_LIST_ELO_BANDS.find((o) => o.id === eloBandId);
  if (!band?.delta) return { min: null, max: null };
  return levelRangeForWindow(clampPlaytomicLevel(userLevel), band.delta);
}

export function defaultKampeListFilter() {
  return { regionId: '', eloBandId: '', onlyOpen: false, onlyBooked: false, facilities: [] };
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
  let eloBandId = String(raw.eloBandId ?? '').trim();
  if (LEGACY_ELO_BAND_IDS.has(eloBandId)) eloBandId = '';
  eloBandId = KAMPE_LIST_ELO_BANDS.some((o) => o.id === eloBandId) ? eloBandId : '';
  const onlyOpen = Boolean(raw.onlyOpen);
  const onlyBooked = Boolean(raw.onlyBooked);
  const facilities = Array.isArray(raw.facilities)
    ? [...new Set(raw.facilities.map((f) => String(f)).filter(Boolean))]
    : [];
  return { regionId, eloBandId, onlyOpen, onlyBooked, facilities };
}

export function kampeListFilterIsActive(filter) {
  const f = normalizeKampeListFilter(filter);
  return Boolean(f.regionId || f.eloBandId || f.onlyOpen || f.onlyBooked || f.facilities.length);
}

export function getKampeListRegionLabel(regionId) {
  const canonical = resolveListRegionId(regionId);
  if (!canonical) return '';
  return regionShortLabel(canonical);
}

export function getKampeListLevelBandLabel(eloBandId, userLevel = null) {
  const band = KAMPE_LIST_ELO_BANDS.find((o) => o.id === eloBandId);
  if (!band?.delta) return band?.label || '';
  const lvl = Number(userLevel);
  if (Number.isFinite(lvl)) {
    const { min, max } = kampeLevelFilterRangeFromUser(eloBandId, lvl);
    return `${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`;
  }
  return band.label;
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


/** 2v2-kamp: overlap mellem kampens niveau og brugerens valgte spænd. */
export function matchPassesKampeLevelBandFilter(match, eloBandId, userLevel = null) {
  if (!eloBandId) return true;
  const { min, max } = kampeLevelFilterRangeFromUser(eloBandId, userLevel ?? 3);
  if (min == null || max == null) return true;
  const { min: eloMin, max: eloMax } = parseMatchLevelRange(match?.level_range);
  const matchLevels = eloRangeToLevelRange(eloMin, eloMax);
  if (!matchLevels) return true;
  return matchLevels.min <= max && min <= matchLevels.max;
}

/** 2v2-kamp: bane-region slår opretter-region; uden bane → opretterens profil. */
export function matchPassesKampeRegionFilter(match, regionId, profilesById = {}) {
  if (!regionId) return true;
  const effective = resolveMatchEffectiveRegion(match, profilesById);
  return effectiveRegionMatchesFilter(effective, regionId);
}

/** 2v2-kamp: banens faciliteter skal indeholde alle valgte faciliteter. */
export function matchPassesKampeFacilityFilter(match, facilities, courtFacilitiesById = {}) {
  if (!Array.isArray(facilities) || facilities.length === 0) return true;
  const courtFacilities = courtFacilitiesById[String(match?.court_id)] || [];
  const set = new Set(courtFacilities.map((f) => String(f)));
  return facilities.every((f) => set.has(String(f)));
}

export function matchPassesKampeListFilter(match, filter, { profilesById, userLevel, courtFacilitiesById } = {}) {
  const f = normalizeKampeListFilter(filter);
  if (!matchPassesKampeRegionFilter(match, f.regionId, profilesById)) return false;
  if (!matchPassesKampeLevelBandFilter(match, f.eloBandId, userLevel)) return false;
  if (!matchPassesKampeFacilityFilter(match, f.facilities, courtFacilitiesById)) return false;
  if (f.onlyOpen && match?.status === 'full') return false;
  if (f.onlyBooked) {
    const { booked } = parseMatchLevelRange(match?.level_range);
    if (!booked) return false;
  }
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
