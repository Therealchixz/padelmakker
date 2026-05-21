/**
 * Playtomic-agtigt niveau (ca. 1.0–7.0) — bruges i kamp-filter og makkersøgning.
 * ELO bruges internt til overlap mod kampe der kun har elo: i level_range.
 */

import { parseMatchLevelRange } from './matchLevelRange';
import { levelLabel } from './platformConstants';

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
 * @param {number} myLevel
 * @param {number} levelWindow
 * @param {object|null} creatorProfile
 * @param {object} match
 */
export function matchPassesLevelFilter(myLevel, levelWindow, creatorProfile, match) {
  const center = clampPlaytomicLevel(myLevel);
  const { min: filtMin, max: filtMax } = levelRangeForWindow(center, levelWindow);
  const creatorLevel = profilePlaytomicLevel(creatorProfile);

  if (!levelsOverlap(filtMin, filtMax, creatorLevel, creatorLevel)) {
    return false;
  }

  const range = parseMatchLevelRange(match?.level_range);
  if (range.min != null && range.max != null) {
    const matchLevels = eloRangeToLevelRange(range.min, range.max);
    if (matchLevels && !levelsOverlap(filtMin, filtMax, matchLevels.min, matchLevels.max)) {
      return false;
    }
  }

  return true;
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
