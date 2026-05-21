/**
 * Makker-filter matching (baneside, intention, stil, tid, niveau-retning).
 * Spejler matchmakingUtils-scoring, men returnerer pass/fail til filter + notifikationer.
 */

import { AVAILABILITY } from './platformConstants';
import { normalizeStringArrayField } from './profileUtils';
import {
  profilePlaytomicLevel,
  clampPlaytomicLevel,
  levelRangeForWindow,
} from './padelLevelUtils';

export const MAKKER_COURT_SIDE_MODES = [
  { value: 'complementary', label: 'Komplementær', hint: 'Venstre + højre — typisk i double' },
  { value: 'same', label: 'Samme side som mig', hint: 'Fx begge venstre' },
  { value: 'any', label: 'Ligegyldigt', hint: 'Alle banesider' },
];

export const MAKKER_INTENT_MODES = [
  { value: 'compatible', label: 'Lignende intention', hint: 'Anbefalet' },
  { value: 'exact', label: 'Kun valgte intentioner', hint: 'Streng match' },
];

export const MAKKER_PARTNER_LEVEL_FILTERS = [
  { value: '', label: 'Fra min profil', hint: 'Bruger “ønsket makkerniveau” under Rediger' },
  { value: 'same', label: 'Samme niveau', hint: '± tolerance' },
  { value: 'stronger', label: 'Lidt stærkere', hint: 'Mest over dit niveau' },
  { value: 'weaker', label: 'Lidt svagere', hint: 'Mest under dit niveau' },
  { value: 'wide', label: 'Bredt', hint: 'Alle niveauer i regionen' },
];

const VALID_COURT_MODES = new Set(MAKKER_COURT_SIDE_MODES.map((m) => m.value));
const VALID_INTENT_MODES = new Set(MAKKER_INTENT_MODES.map((m) => m.value));
const VALID_PARTNER_LEVELS = new Set(MAKKER_PARTNER_LEVEL_FILTERS.map((p) => p.value));
const VALID_PLAY_STYLES = new Set(['all', 'Offensiv', 'Defensiv', 'Allround']);
const INTENT_KEYS = ['hygge', 'traening', 'konkurrence', 'fast_makker', 'turnering'];

const INTENT_COMPAT = {
  konkurrence: { konkurrence: 1.0, traening: 0.6, hygge: 0.2, fast_makker: 0.5, turnering: 0.8 },
  traening: { konkurrence: 0.6, traening: 1.0, hygge: 0.5, fast_makker: 0.7, turnering: 0.5 },
  hygge: { konkurrence: 0.2, traening: 0.5, hygge: 1.0, fast_makker: 0.8, turnering: 0.3 },
  fast_makker: { konkurrence: 0.5, traening: 0.7, hygge: 0.8, fast_makker: 1.0, turnering: 0.4 },
  turnering: { konkurrence: 0.8, traening: 0.5, hygge: 0.3, fast_makker: 0.4, turnering: 1.0 },
};

function normalizeText(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCourtSide(value) {
  const v = normalizeText(value);
  if (v.includes('venstre')) return 'venstre';
  if (v.includes('hojre') || v.includes('højre')) return 'hojre';
  if (v.includes('begge')) return 'begge';
  return '';
}

function normalizeIntent(value) {
  const v = normalizeText(value).replace(/\s+/g, '_');
  if (!v) return '';
  if (v.includes('konkurrence')) return 'konkurrence';
  if (v.includes('traening') || v.includes('træning')) return 'traening';
  if (v.includes('hygge')) return 'hygge';
  if (v.includes('fast_makker') || v.includes('fast')) return 'fast_makker';
  if (v.includes('turnering')) return 'turnering';
  return v;
}

function courtSideScore(mySide, theirSide) {
  const mine = normalizeCourtSide(mySide);
  const theirs = normalizeCourtSide(theirSide);
  if (!mine || !theirs) return 0.5;
  if (mine === 'begge' || theirs === 'begge') return 0.6;
  const complementary =
    (mine === 'venstre' && theirs === 'hojre') ||
    (mine === 'hojre' && theirs === 'venstre');
  return complementary ? 1.0 : 0.35;
}

function intentCompatScore(myIntent, theirIntent) {
  const mine = normalizeIntent(myIntent);
  const theirs = normalizeIntent(theirIntent);
  if (!mine || !theirs) return 0.4;
  return INTENT_COMPAT[mine]?.[theirs] ?? 0.4;
}

function normalizeAvailabilityList(value) {
  const list = normalizeStringArrayField(value);
  const allowed = new Set(AVAILABILITY.map((a) => normalizeText(a)));
  return list.filter((x) => allowed.has(normalizeText(x)));
}

export function normalizeMakkerPartnerLevel(raw, profile = {}) {
  const v = String(raw ?? profile?.preferred_partner_level ?? '').toLowerCase().trim();
  if (VALID_PARTNER_LEVELS.has(v)) return v;
  return '';
}

export function levelRangeForMakkerPartnerPref(center, levelWindow, partnerLevelPref, profile = {}) {
  const c = clampPlaytomicLevel(center);
  const w = Math.max(0.1, Math.min(0.5, Number(levelWindow) || 0.2));
  const pref = normalizeMakkerPartnerLevel(partnerLevelPref, profile);

  if (pref === 'wide') {
    return { min: 1, max: 7 };
  }
  if (pref === 'stronger') {
    return {
      min: c,
      max: clampPlaytomicLevel(c + w + 0.15),
    };
  }
  if (pref === 'weaker') {
    return {
      min: clampPlaytomicLevel(c - w - 0.15),
      max: c,
    };
  }
  return levelRangeForWindow(c, w);
}

export function subjectPassesMakkerLevelFilter(watcherLevel, levelWindow, partnerLevelPref, profile, subjectProfile) {
  const { min, max } = levelRangeForMakkerPartnerPref(watcherLevel, levelWindow, partnerLevelPref, profile);
  const subjectLevel = profilePlaytomicLevel(subjectProfile);
  return subjectLevel >= min && subjectLevel <= max;
}

export function courtSideMatchesMakkerFilter(watcherCourtSide, mode, subjectCourtSide) {
  const m = VALID_COURT_MODES.has(mode) ? mode : 'complementary';
  if (m === 'any') return true;
  const score = courtSideScore(watcherCourtSide, subjectCourtSide);
  if (m === 'complementary') return score >= 0.9;
  if (m === 'same') return score < 0.5;
  return true;
}

export function playStyleMatchesMakkerFilter(filterStyle, subjectPlayStyle) {
  const style = VALID_PLAY_STYLES.has(filterStyle) ? filterStyle : 'all';
  if (style === 'all') return true;
  const subj = String(subjectPlayStyle || '').trim();
  if (!subj || subj === 'Ved ikke endnu') return true;
  return subj === style;
}

export function intentMatchesMakkerFilter(selectedIntents, intentMode, subjectIntent) {
  const selected = normalizeStringArrayField(selectedIntents).filter((k) => INTENT_KEYS.includes(k));
  if (!selected.length) return true;
  const theirs = normalizeIntent(subjectIntent);
  if (!theirs) return true;
  const mode = VALID_INTENT_MODES.has(intentMode) ? intentMode : 'compatible';
  if (mode === 'exact') {
    return selected.includes(theirs);
  }
  return selected.some((mine) => intentCompatScore(mine, theirs) >= 0.6);
}

export function availabilityMatchesMakkerFilter(filterAvailability, subjectAvailability) {
  const f = normalizeAvailabilityList(filterAvailability);
  if (!f.length) return true;
  const s = normalizeAvailabilityList(subjectAvailability);
  if (!s.length) return true;
  const sNorm = s.map(normalizeText);
  return f.some((x) => sNorm.includes(normalizeText(x)));
}

export function normalizeMakkerFilterExtras(parsed = {}, profile = {}) {
  const courtSideMode = VALID_COURT_MODES.has(parsed.courtSideMode) ? parsed.courtSideMode : 'complementary';
  const playStyle = VALID_PLAY_STYLES.has(parsed.playStyle) ? parsed.playStyle : 'all';
  const intents = [
    ...new Set(
      normalizeStringArrayField(parsed.intents)
        .map((k) => normalizeIntent(k))
        .filter((k) => INTENT_KEYS.includes(k)),
    ),
  ];
  const intentMode = VALID_INTENT_MODES.has(parsed.intentMode) ? parsed.intentMode : 'compatible';
  const partnerLevel = normalizeMakkerPartnerLevel(parsed.partnerLevel, profile);
  const availability = normalizeAvailabilityList(parsed.availability);
  return { courtSideMode, playStyle, intents, intentMode, partnerLevel, availability };
}
