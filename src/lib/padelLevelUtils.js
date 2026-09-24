/**
 * Playtomic-agtigt niveau (ca. 1.0–7.0) — bruges i kamp-filter og makkersøgning.
 * ELO bruges internt til overlap mod kampe der kun har elo: i level_range.
 */

import { parseMatchLevelRange } from './matchLevelRange.js';
import { levelLabel } from './platformConstants.js';

export const PLAYTOMIC_LEVEL_MIN = 1;
export const PLAYTOMIC_LEVEL_MAX = 7;
export const DEFAULT_PLAYTOMIC_LEVEL = 3;

/** ELO 800 @ niveau 1, ~1067 @ niveau 7 (samme spænd som profil cold-start, skaleret 1–7). */
const ELO_AT_LEVEL_1 = 800;
const ELO_PER_LEVEL = 400 / 6;

export function clampPlaytomicLevel(value, fallback = DEFAULT_PLAYTOMIC_LEVEL) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.max(PLAYTOMIC_LEVEL_MIN, Math.min(PLAYTOMIC_LEVEL_MAX, n)) * 10) / 10;
}

/** Parse niveau fra formular (tal eller legacy LEVELS-streng). */
export function parsePlaytomicLevelField(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clampPlaytomicLevel(raw);
  }
  const fromStr = parseFloat(String(raw).match(/[\d.]+/)?.[0] || '');
  if (!Number.isFinite(fromStr)) return null;
  return clampPlaytomicLevel(fromStr);
}

export function profilePlaytomicLevel(profile) {
  return clampPlaytomicLevel(profile?.level, DEFAULT_PLAYTOMIC_LEVEL);
}

export function levelToElo(level) {
  const l = clampPlaytomicLevel(level);
  return Math.round(ELO_AT_LEVEL_1 + (l - 1) * ELO_PER_LEVEL);
}

export function eloToLevel(elo) {
  const e = Number(elo);
  if (!Number.isFinite(e)) return DEFAULT_PLAYTOMIC_LEVEL;
  const raw = 1 + (e - ELO_AT_LEVEL_1) / ELO_PER_LEVEL;
  return clampPlaytomicLevel(raw);
}

export function formatPlaytomicLevel(level) {
  return clampPlaytomicLevel(level).toFixed(1);
}

/** Playtomic-interval med luft omkring tankestreg, fx "3.3 – 6.6". */
export function formatPlaytomicLevelRange(min, max) {
  return `${formatPlaytomicLevel(min)} – ${formatPlaytomicLevel(max)}`;
}

/** ELO-interval med luft omkring tankestreg, fx "1040 – 1200 ELO". */
export function formatEloRange(eloMin, eloMax) {
  const a = Number(eloMin);
  const b = Number(eloMax);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const lo = Math.round(Math.min(a, b));
  const hi = Math.round(Math.max(a, b));
  return `${lo} – ${hi} ELO`;
}

/** Opdelt ELO + Playtomic-niveau til kompakte UI-chips. */
export function formatMatchLevelRangeParts(eloMin, eloMax) {
  const levelRange = eloRangeToLevelRange(eloMin, eloMax);
  const elo = formatEloRange(eloMin, eloMax);
  if (!levelRange || !elo) return null;
  return {
    elo,
    niveau: `Niveau ${formatPlaytomicLevelRange(levelRange.min, levelRange.max)}`,
  };
}

/** Én linje — bruges i opsummeringer og kvitteringer. */
export function formatMatchLevelRangeLabel(eloMin, eloMax) {
  const parts = formatMatchLevelRangeParts(eloMin, eloMax);
  if (!parts) return null;
  return `${parts.elo} · ${parts.niveau}`;
}

/** Visning af profilniveau: Playtomic-tal (fx 2,3), evt. med band-label i parentes. */
export function profileLevelDisplayText(level) {
  if (level == null || level === '') return null;
  const num = formatPlaytomicLevel(level);
  const band = levelLabel(level);
  return band ? `${num} (${band})` : num;
}

export function levelRangeForWindow(center, window) {
  const c = clampPlaytomicLevel(center);
  const w = Math.max(0.1, Math.min(0.5, Number(window) || 0.2));
  return {
    min: clampPlaytomicLevel(c - w),
    max: clampPlaytomicLevel(c + w),
  };
}

/**
 * Standard-niveau for en ny kamp: opretterens eget niveau ± 0,5 (bredeste valg i
 * kampfilteret). Før var det ELO ± 100, hvilket gav ca. ± 1,5 niveau (fx 1.4–4.4)
 * og ikke hang sammen med det niveau, resten af appen viser.
 */
export const MATCH_DEFAULT_LEVEL_WINDOW = 0.5;

export function defaultMatchLevelEloRange(profile) {
  const { min, max } = levelRangeForWindow(profilePlaytomicLevel(profile), MATCH_DEFAULT_LEVEL_WINDOW);
  return { min: levelToElo(min), max: levelToElo(max) };
}

export function levelsOverlap(minA, maxA, minB, maxB) {
  return minA <= maxB && minB <= maxA;
}

export function eloRangeToLevelRange(eloMin, eloMax) {
  if (eloMin == null || eloMax == null) return null;
  const lo = Math.min(eloToLevel(eloMin), eloToLevel(eloMax));
  const hi = Math.max(eloToLevel(eloMin), eloToLevel(eloMax));
  return { min: lo, max: hi };
}

/**
 * Selvvalgt niveau fra-til i et filter (levelMin/levelMax). Null, hvis det
 * ikke er sat (eller kun det ene er sat).
 */
export function customFilterLevelBounds(prefs = {}) {
  const lo = parsePlaytomicLevelField(prefs?.levelMin);
  const hi = parsePlaytomicLevelField(prefs?.levelMax);
  if (lo == null || hi == null) return null;
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) };
}

/**
 * Kampens niveau, som opretteren valgte det (level_range "elo:913-980"). Har
 * kampen intet niveau, bruges opretterens niveau ±0,5 (standarden i Opret kamp).
 * Samme regel som match_level_bounds i databasen.
 */
export function matchLevelBounds(match, creatorProfile) {
  const range = parseMatchLevelRange(match?.level_range);
  if (range.min != null && range.max != null) {
    return eloRangeToLevelRange(range.min, range.max);
  }
  return levelRangeForWindow(profilePlaytomicLevel(creatorProfile), MATCH_DEFAULT_LEVEL_WINDOW);
}

/** Modtagerens ramme i kamp-filteret: selvvalgt spænd, ellers eget niveau. */
export function matchWatcherLevelBounds(prefs, myLevel) {
  const custom = customFilterLevelBounds(prefs);
  if (custom) return custom;
  const lvl = clampPlaytomicLevel(myLevel);
  return { min: lvl, max: lvl };
}

/** Kort tekst om kamp-filterets niveau, fx "Niveau 3.3–3.6" eller "Kampe for niveau 3.2". */
export function matchFilterLevelLabel(prefs, myLevel) {
  const custom = customFilterLevelBounds(prefs);
  if (!custom) return `Kampe for niveau ${formatPlaytomicLevel(myLevel)}`;
  if (custom.min <= PLAYTOMIC_LEVEL_MIN && custom.max >= PLAYTOMIC_LEVEL_MAX) return 'Alle niveauer';
  return `Niveau ${formatPlaytomicLevel(custom.min)}–${formatPlaytomicLevel(custom.max)}`;
}

/**
 * Passer kampen inden for den ramme, brugeren har valgt? Er der valgt et
 * spænd i kamp-filteret, skal det overlappe kampens niveau; ellers skal ens
 * eget niveau ligge inden for kampens niveau. Samme regel som
 * match_fits_watcher_level i databasen (besked om nye kampe).
 *
 * @param {number} myLevel
 * @param {object} prefs kamp-filteret (levelMin/levelMax)
 * @param {object|null} creatorProfile
 * @param {object} match
 */
export function matchPassesLevelFilter(myLevel, prefs, creatorProfile, match) {
  const watcher = matchWatcherLevelBounds(prefs, myLevel);
  const matchRange = matchLevelBounds(match, creatorProfile);
  return levelsOverlap(watcher.min, watcher.max, matchRange.min, matchRange.max);
}

/** Om en spillers profilniveau ligger inden for filterets tolerance. */
export function profilePassesLevelFilter(myLevel, levelWindow, subjectProfile) {
  const center = clampPlaytomicLevel(myLevel);
  const { min: filtMin, max: filtMax } = levelRangeForWindow(center, levelWindow);
  const subjectLevel = profilePlaytomicLevel(subjectProfile);
  return levelsOverlap(filtMin, filtMax, subjectLevel, subjectLevel);
}

/** Migrér ældre eloWindow (±ELO) til niveau-tolerance. */
export function migrateEloWindowToLevelWindow(eloWindow) {
  const w = Number(eloWindow);
  if (!Number.isFinite(w)) return 0.2;
  if (w <= 175) return 0.2;
  if (w <= 275) return 0.3;
  if (w <= 350) return 0.4;
  return 0.5;
}
