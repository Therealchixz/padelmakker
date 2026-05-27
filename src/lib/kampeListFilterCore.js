/**
 * Lokale liste-filtre til Kampe-fanen (2v2 / turnering / liga).
 * Adskilt fra "Mit kamp-filter" på profilen (notifikationer + søger-synlighed).
 */

import { parseMatchLevelRange } from './matchLevelRange.js';

export const KAMPE_LIST_REGION_OPTIONS = [
  { id: '', label: 'Alle', keywords: [] },
  {
    id: 'kbh',
    label: 'København',
    keywords: ['københavn', 'copenhagen', 'hovedstaden', 'frederiksberg', 'gentofte', 'gladsaxe'],
  },
  {
    id: 'aarhus',
    label: 'Aarhus',
    keywords: ['aarhus', 'århus', 'midtjylland', 'randers', 'silkeborg'],
  },
  {
    id: 'odense',
    label: 'Odense',
    keywords: ['odense', 'fyn', 'syddanmark', 'svendborg', 'nyborg'],
  },
  {
    id: 'aalborg',
    label: 'Aalborg',
    keywords: ['aalborg', 'nordjylland', 'hjørring', 'frederikshavn'],
  },
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

export function normalizeKampeListFilter(raw) {
  const base = defaultKampeListFilter();
  if (!raw || typeof raw !== 'object') return base;
  const regionId = KAMPE_LIST_REGION_OPTIONS.some((o) => o.id === raw.regionId) ? raw.regionId : '';
  const eloBandId = KAMPE_LIST_ELO_BANDS.some((o) => o.id === raw.eloBandId) ? raw.eloBandId : '';
  return { regionId, eloBandId };
}

export function kampeListFilterIsActive(filter) {
  const f = normalizeKampeListFilter(filter);
  return Boolean(f.regionId || f.eloBandId);
}

export function getKampeListRegionLabel(regionId) {
  return KAMPE_LIST_REGION_OPTIONS.find((o) => o.id === regionId)?.label || '';
}

export function getKampeListEloBandLabel(eloBandId) {
  return KAMPE_LIST_ELO_BANDS.find((o) => o.id === eloBandId)?.label || '';
}

function normalizeHaystack(values) {
  return values
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(' ');
}

/** Match tekst mod valgt by/region (tom id = ingen filtrering). */
export function textMatchesKampeRegionFilter(textFields, regionId) {
  if (!regionId) return true;
  const opt = KAMPE_LIST_REGION_OPTIONS.find((o) => o.id === regionId);
  if (!opt || opt.keywords.length === 0) return true;
  const hay = normalizeHaystack(textFields);
  if (!hay.trim()) return false;
  return opt.keywords.some((kw) => hay.includes(kw));
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

/** 2v2-kamp: region via bane-navn + opretters område. */
export function matchPassesKampeRegionFilter(match, regionId, profilesById = {}) {
  if (!regionId) return true;
  const creator = profilesById[String(match?.creator_id)] || {};
  return textMatchesKampeRegionFilter(
    [match?.court_name, creator?.area, creator?.city],
    regionId,
  );
}

export function matchPassesKampeListFilter(match, filter, { profilesById } = {}) {
  const f = normalizeKampeListFilter(filter);
  if (!matchPassesKampeRegionFilter(match, f.regionId, profilesById)) return false;
  if (!matchPassesKampeEloBandFilter(match, f.eloBandId)) return false;
  return true;
}

/** Turnering: region via bane-navn. */
export function tournamentPassesKampeRegionFilter(tournament, regionId, courtName = '') {
  if (!regionId) return true;
  return textMatchesKampeRegionFilter([courtName, tournament?.name, tournament?.description], regionId);
}
