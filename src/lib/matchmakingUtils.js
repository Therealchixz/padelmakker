/**
 * Matchmaking scoring v2
 *
 * Fokus:
 * - Reciprocal score (begge parter skal passe sammen)
 * - Hard filters for tydelig mismatch
 * - Recency/aktivitet boost
 * - Lokal fairness via exposure penalty (samme profiler vises ikke konstant)
 */

import { SEEK_MAKKER_TTL_DAYS } from './platformConstants.js';
import { canonicalAppRegion } from './appRegions.js';
import { haversineKm, parseGeoCoords } from './geoDistance.js';

/** Kanonisk landsdel for matchmaking (legacy "Region X" → app-region). */
export function profileMatchRegion(profile) {
  return canonicalAppRegion(profile?.area) || '';
}

const INACTIVE_DAYS = 14;
const SEEKING_FRESH_HOURS = SEEK_MAKKER_TTL_DAYS * 24;

/** Vægte: geo højere — padel-makkere skal typisk kunne mødes i praksis. */
const DIRECTIONAL_WEIGHTS = {
  skill: 0.28,
  time: 0.22,
  geo: 0.30,
  intent: 0.12,
  courtSide: 0.08,
};

const DEFAULTS = {
  maxEloDiff: 260,
  requireTimeOverlap: true,
  /** Soft max når begge har koordinater — længere kun hvis begge er rejsevillige. */
  maxDistanceKm: 60,
  maxTravelWillingKm: 120,
  /** Under dette antal forslag udvides søgningen frem for at vise en tom liste. */
  minSuggestions: 3,
};

/**
 * Trinvis opblødning. Første trin er det vi helst vil vise: lokalt og
 * niveaunært. Er feltet for tyndt, udvides der frem for at efterlade brugeren
 * med en tom skærm — resultater ud over første trin markeres
 * `beyondPreferredRadius`, så UI kan skrive afstanden tydeligt.
 */
const RELAXATION_LADDER = [
  { maxDistanceKm: 60, maxEloDiff: 260, requireTimeOverlap: true },
  { maxDistanceKm: 120, maxEloDiff: 350, requireTimeOverlap: false },
  { maxDistanceKm: 260, maxEloDiff: 500, requireTimeOverlap: false },
  {
    maxDistanceKm: Number.POSITIVE_INFINITY,
    maxEloDiff: Number.POSITIVE_INFINITY,
    requireTimeOverlap: false,
  },
];

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * Læs en valgfri øvre grænse. Infinity betyder "ingen grænse" og skal derfor
 * slippe igennem — Number.isFinite() ville ellers sende den i fallback.
 */
function limitOrNull(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw
    .replace(/Ã¦/g, 'ae')
    .replace(/Ã¸/g, 'o')
    .replace(/Ã¥/g, 'a')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizedList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => normalizeText(v))
    .filter(Boolean);
}

function jaccardOverlap(a, b) {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  const intersectionCount = a.filter((x) => bSet.has(x)).length;
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return intersectionCount / union.size;
}

function overlapCount(a, b) {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  return a.filter((x) => bSet.has(x)).length;
}

export function resolveElo(profile, eloByUserId = {}) {
  const key = String(profile?.id || '');
  const fromMap = toNumber(eloByUserId[key], NaN);
  if (Number.isFinite(fromMap)) return Math.round(fromMap);
  return Math.round(toNumber(profile?.elo_rating, 1000));
}

function resolveGamesPlayed(profile, gamesByUserId = {}) {
  const key = String(profile?.id || '');
  const fromMap = toNumber(gamesByUserId[key], NaN);
  if (Number.isFinite(fromMap) && fromMap >= 0) return Math.round(fromMap);
  return Math.round(toNumber(profile?.games_played, 0));
}

/**
 * Cold-start ELO: helt nye spillere har ingen kamphistorik, og rå ELO 1000 er
 * misvisende. Bland ratingen med deres signup-niveau indtil de har spillet
 * mindst 5 kampe. Niveau 1-10 → ELO 800-1200.
 */
function resolveEloWithContext(profile, eloByUserId = {}, gamesByUserId = {}) {
  const baseElo = resolveElo(profile, eloByUserId);
  const played = resolveGamesPlayed(profile, gamesByUserId);
  if (played >= 5) return baseElo;
  const level = toNumber(profile?.level, 5);
  const levelAsElo = 800 + (level - 1) * (400 / 9);
  const levelWeight = Math.max(0, (5 - played) / 5);
  return Math.round(baseElo * (1 - levelWeight) + levelAsElo * levelWeight);
}

/**
 * Justér ELO med vinder-rate når der er nok kampe at gå ud fra: en spiller
 * der vinder 70% af deres kampe spiller sandsynligvis stærkere end deres ELO
 * antyder, og vice versa. ±50 ELO-justering ved >=10 kampe.
 */
function winRateAdjustedElo(profile, baseElo) {
  const played = toNumber(profile?.games_played, 0);
  if (played < 10) return baseElo;
  const won = toNumber(profile?.games_won, 0);
  const winRate = won / played;
  return baseElo + (winRate - 0.5) * 100;
}

/** Wider tolerance når brugeren har sat preferred_partner_level til "wide". */
function partnerLevelTolerance(profile) {
  const pref = String(profile?.preferred_partner_level || '').toLowerCase();
  return pref === 'wide' ? 600 : 400;
}

function skillScore(myElo, theirElo, myProfile, theirProfile) {
  const myAdjusted = winRateAdjustedElo(myProfile, myElo);
  const theirAdjusted = winRateAdjustedElo(theirProfile, theirElo);
  const diff = Math.abs(toNumber(myAdjusted, 1000) - toNumber(theirAdjusted, 1000));
  /* Tolerancen tages som maks af begges præference, så ingen side bliver
     skarpere end nødvendigt — "wide" hos én er nok til at åbne båndet. */
  const tolerance = Math.max(partnerLevelTolerance(myProfile), partnerLevelTolerance(theirProfile));
  return clamp01(1 - diff / tolerance);
}

/**
 * Asymmetrisk boost: belønner kandidater der matcher brugerens "stronger"/
 * "weaker"-præference. Det reciprokke skill-score er symmetrisk per design,
 * så vi kan ikke skubbe præferencen ind via vægtene alene — i stedet
 * tilføjes en ensidig boost (max +0.08) når kandidat-ELO ligger i sweet-zonen.
 */
function partnerPreferenceBoost(myProfile, myElo, candidateElo) {
  const pref = String(myProfile?.preferred_partner_level || '').toLowerCase();
  if (!pref || pref === 'same' || pref === 'wide') return 0;
  const rawDiff = toNumber(candidateElo, 1000) - toNumber(myElo, 1000);
  let sweetCenter;
  if (pref === 'stronger' && rawDiff > 0) sweetCenter = 100;
  else if (pref === 'weaker' && rawDiff < 0) sweetCenter = -100;
  else return 0;
  const distance = Math.abs(rawDiff - sweetCenter);
  /* Maks 0.14 ved nøjagtigt sweetCenter — skal overgå skill-score penalty (≈0.08
     ved 100 ELO diff) for at præferencen tilter resultatet. Lineær fade til 0
     ved 600 ELO væk. */
  return Math.max(0, 0.14 * (1 - distance / 600));
}

function timeScore(myProfile, theirProfile) {
  const myDays = normalizedList(myProfile?.available_days);
  const theirDays = normalizedList(theirProfile?.available_days);
  const myAvail = normalizedList(myProfile?.availability);
  const theirAvail = normalizedList(theirProfile?.availability);
  /* Valgfrit fremtidigt signup-felt: time_of_day_pref = ['morgen','eftermiddag','aften'] */
  const myTimes = normalizedList(myProfile?.time_of_day_pref);
  const theirTimes = normalizedList(theirProfile?.time_of_day_pref);

  const hasDays = myDays.length > 0 && theirDays.length > 0;
  const hasAvail = myAvail.length > 0 && theirAvail.length > 0;
  const hasTimes = myTimes.length > 0 && theirTimes.length > 0;

  /* Manglende data scorer lavt — tomme profiler skal ikke rangeres højt */
  if (!hasDays && !hasAvail && !hasTimes) return 0.35;

  let total = 0;
  let weightSum = 0;
  if (hasDays) {
    total += 0.55 * jaccardOverlap(myDays, theirDays);
    weightSum += 0.55;
  }
  if (hasAvail) {
    total += 0.3 * jaccardOverlap(myAvail, theirAvail);
    weightSum += 0.3;
  }
  if (hasTimes) {
    total += 0.4 * jaccardOverlap(myTimes, theirTimes);
    weightSum += 0.4;
  }
  return weightSum > 0 ? clamp01(total / weightSum) : 0.35;
}

function hasTimeOverlapSignal(myProfile, theirProfile) {
  const myDays = normalizedList(myProfile?.available_days);
  const theirDays = normalizedList(theirProfile?.available_days);
  const myAvail = normalizedList(myProfile?.availability);
  const theirAvail = normalizedList(theirProfile?.availability);

  const daysComparable = myDays.length > 0 && theirDays.length > 0;
  const availComparable = myAvail.length > 0 && theirAvail.length > 0;
  const daysOverlap = overlapCount(myDays, theirDays);
  const availOverlap = overlapCount(myAvail, theirAvail);

  const hasComparable = daysComparable || availComparable;
  const hasOverlap = (!daysComparable || daysOverlap > 0) && (!availComparable || availOverlap > 0);

  return { hasComparable, hasOverlap, daysOverlap, availOverlap };
}

/** Afstand i km mellem profiler, eller null hvis koordinater mangler. */
export function distanceKmBetweenProfiles(a, b) {
  const p1 = parseGeoCoords(a?.latitude, a?.longitude);
  const p2 = parseGeoCoords(b?.latitude, b?.longitude);
  if (!p1 || !p2) return null;
  return haversineKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
}

function geoScore(myProfile, theirProfile) {
  const km = distanceKmBetweenProfiles(myProfile, theirProfile);

  if (km != null) {
    // Skarp kurve: lokale makkere først, 100+ km er næsten ubrugeligt.
    if (km <= 15) return 1.0;
    if (km <= 30) return 0.85;
    if (km <= 45) return 0.55;
    if (km <= 60) return 0.28;
    if (km <= 90) return 0.08;
    return 0.02;
  }

  const myArea = profileMatchRegion(myProfile);
  const theirArea = profileMatchRegion(theirProfile);
  if (!myArea || !theirArea) return 0.25;
  if (myArea === theirArea) return 0.7;
  /* Begge er villige til at rejse → mindre straf for forskellige områder */
  if (myProfile?.travel_willing && theirProfile?.travel_willing) return 0.3;
  return 0.1;
}

/** Lavere = tættere på. Bruges til sortering, så lokale altid ligger øverst. */
function distanceBand(myProfile, candidate) {
  const km = distanceKmBetweenProfiles(myProfile, candidate);
  if (km != null) {
    if (km <= 30) return 0;
    if (km <= 60) return 1;
    if (km <= 120) return 3;
    if (km <= 260) return 4;
    return 5;
  }
  const myRegion = profileMatchRegion(myProfile);
  const theirRegion = profileMatchRegion(candidate);
  if (myRegion && theirRegion && myRegion === theirRegion) return 2;
  return 5;
}

/** Nærhed først, derefter score — bruges både til forslag og fuld makker-søgning. */
function compareRankedSuggestions(a, b, myRegion) {
  if (a.distanceBand !== b.distanceBand) return a.distanceBand - b.distanceBand;
  if (myRegion && a.sameRegion !== b.sameRegion) {
    return a.sameRegion ? -1 : 1;
  }
  if (b.score !== a.score) return b.score - a.score;
  const aExposure = Number(a.breakdown?.exposureCount || 0);
  const bExposure = Number(b.breakdown?.exposureCount || 0);
  if (aExposure !== bExposure) return aExposure - bExposure;
  return String(a.profile?.id || '').localeCompare(String(b.profile?.id || ''));
}

function buildRankedCandidate(myProfile, candidate, opts, myRegion) {
  const score = scoreCandidate(myProfile, candidate, opts);
  const km = distanceKmBetweenProfiles(myProfile, candidate);
  return {
    profile: candidate,
    score: score.total,
    breakdown: score.breakdown,
    resolvedElo: score.resolvedElo,
    sameRegion: Boolean(myRegion && profileMatchRegion(candidate) === myRegion),
    distanceKm: km,
    distanceBand: distanceBand(myProfile, candidate),
  };
}

function withinSuggestionDistance(myProfile, candidate, opts = {}) {
  const km = distanceKmBetweenProfiles(myProfile, candidate);
  if (km == null) return true; // ingen coords → region/score håndterer resten

  const bothTravel = Boolean(myProfile?.travel_willing && candidate?.travel_willing);
  const explicitMax = limitOrNull(opts?.maxDistanceKm);
  const maxKm = explicitMax != null
    ? explicitMax
    : bothTravel
      ? DEFAULTS.maxTravelWillingKm
      : DEFAULTS.maxDistanceKm;
  const explicitTravelCap = limitOrNull(opts?.maxTravelWillingKm);
  const travelCap = explicitTravelCap != null ? explicitTravelCap : DEFAULTS.maxTravelWillingKm;
  const cap = bothTravel ? Math.max(maxKm, travelCap) : maxKm;
  return km <= cap;
}

function normalizeCourtSide(value) {
  const v = normalizeText(value);
  if (!v) return '';
  if (v.includes('venstre')) return 'venstre';
  if (v.includes('hojre')) return 'hojre';
  if (v.includes('begge')) return 'begge';
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

function normalizeIntent(value) {
  const v = normalizeText(value).replace(/\s+/g, '_');
  if (!v) return '';
  if (v.includes('konkurrence')) return 'konkurrence';
  if (v.includes('traening')) return 'traening';
  if (v.includes('hygge')) return 'hygge';
  if (v.includes('fast_makker')) return 'fast_makker';
  if (v.includes('turnering')) return 'turnering';
  return v;
}

const INTENT_COMPAT = {
  konkurrence: { konkurrence: 1.0, traening: 0.6, hygge: 0.2, fast_makker: 0.5, turnering: 0.8 },
  traening: { konkurrence: 0.6, traening: 1.0, hygge: 0.5, fast_makker: 0.7, turnering: 0.5 },
  hygge: { konkurrence: 0.2, traening: 0.5, hygge: 1.0, fast_makker: 0.8, turnering: 0.3 },
  fast_makker: { konkurrence: 0.5, traening: 0.7, hygge: 0.8, fast_makker: 1.0, turnering: 0.4 },
  turnering: { konkurrence: 0.8, traening: 0.5, hygge: 0.3, fast_makker: 0.4, turnering: 1.0 },
};

function intentScore(myIntent, theirIntent) {
  const mine = normalizeIntent(myIntent);
  const theirs = normalizeIntent(theirIntent);
  if (!mine || !theirs) return 0.4;
  const row = INTENT_COMPAT[mine];
  if (!row) return 0.4;
  return row[theirs] ?? 0.4;
}

function lastActiveScore(profile) {
  if (!profile?.last_active_at) return 0.65;
  const ageMs = Date.now() - new Date(profile.last_active_at).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.65;
  const maxMs = INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  return clamp01(1 - ageMs / maxMs);
}

function seekingRecencyScore(profile) {
  if (!profile?.seeking_match || !profile?.seeking_match_at) return 0;
  const ageMs = Date.now() - new Date(profile.seeking_match_at).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0;
  const maxMs = SEEKING_FRESH_HOURS * 60 * 60 * 1000;
  return clamp01(1 - ageMs / maxMs);
}

function isActive(profile) {
  return lastActiveScore(profile) > 0;
}

function directionalScore(fromProfile, toProfile, fromElo, toElo) {
  const components = {
    skill: skillScore(fromElo, toElo, fromProfile, toProfile),
    time: timeScore(fromProfile, toProfile),
    geo: geoScore(fromProfile, toProfile),
    intent: intentScore(fromProfile?.intent_now, toProfile?.intent_now),
    courtSide: courtSideScore(fromProfile?.court_side, toProfile?.court_side),
  };

  const weighted =
    components.skill * DIRECTIONAL_WEIGHTS.skill +
    components.time * DIRECTIONAL_WEIGHTS.time +
    components.geo * DIRECTIONAL_WEIGHTS.geo +
    components.intent * DIRECTIONAL_WEIGHTS.intent +
    components.courtSide * DIRECTIONAL_WEIGHTS.courtSide;

  return { total01: clamp01(weighted), components };
}

function inviteAcceptanceAdjustment(stats) {
  if (!stats || !Number.isFinite(stats.sent) || stats.sent <= 0) return 0;
  const sent = Math.max(0, Number(stats.sent));
  const rate = clamp01(Number(stats.acceptanceRate));
  const confidence = clamp01(sent / 5);
  const centered = (rate - 0.5) * 2; // -1..1
  return centered * 0.05 * confidence;
}

function exposurePenalty(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 0) return 0;
  return Math.min(0.09, Math.log2(1 + n) * 0.02);
}

/**
 * Boost baseret på tidligere kampe sammen. To stærke signaler:
 *
 *  - **Kemi som makker**: hvis de har vundet mange kampe sammen, er de godt
 *    sammen-spillende — vægter højere end win-rate som modstandere.
 *  - **Balance som modstandere**: hvis de tit har spillet 50/50 mod hinanden,
 *    er det god skill-match — det er præcis hvad matchmakeren leder efter.
 *
 *  Familiarity gør boostet større jo flere kampe de har sammen (log-skala op
 *  til 10 kampe). Max +0.15 boost — designet til at trumfe små skill-forskelle
 *  uden at overdøve hard filters.
 */
function pastMatchesBoost(candidateId, pastMatchesByUserId) {
  if (!candidateId || !pastMatchesByUserId) return 0;
  const stats = pastMatchesByUserId[String(candidateId)];
  if (!stats) return 0;

  const teammateCount = Math.max(0, Number(stats.asTeammate) || 0);
  const opponentCount = Math.max(0, Number(stats.asOpponent) || 0);
  const total = teammateCount + opponentCount;
  if (total === 0) return 0;

  /* 0 → 1 ramper op fra 0 til 10 delte kampe */
  const familiarityFactor = Math.min(1, Math.log2(1 + total) / Math.log2(11));

  let chemistryBoost = 0;
  if (teammateCount >= 2) {
    const winRate = (Number(stats.winsAsTeammate) || 0) / teammateCount;
    chemistryBoost = Math.max(0, winRate - 0.4) * 0.3;
  }

  let balanceBoost = 0;
  if (opponentCount >= 2) {
    const winRateAgainst = (Number(stats.winsAgainst) || 0) / opponentCount;
    const balance = 1 - Math.abs(winRateAgainst - 0.5) * 2;
    balanceBoost = Math.max(0, balance) * 0.12;
  }

  return Math.min(0.15, familiarityFactor * (chemistryBoost + balanceBoost));
}

/** Eksplicit favorit fra brugeren → tungt boost; man har allerede sagt "ja". */
function favoriteBoost(candidateId, favoriteIds) {
  if (!candidateId || !favoriteIds) return 0;
  return favoriteIds.has(String(candidateId)) ? 0.18 : 0;
}

function passesHardFilters(myProfile, candidate, myElo, candidateElo, opts) {
  if (candidate?.id === myProfile?.id) return false;
  if (candidate?.is_banned) return false;
  if (!isActive(candidate)) return false;

  const explicitEloDiff = limitOrNull(opts?.maxEloDiff);
  const maxEloDiff = explicitEloDiff != null ? explicitEloDiff : DEFAULTS.maxEloDiff;
  if (Math.abs(myElo - candidateElo) > maxEloDiff) return false;

  const requireTimeOverlap = opts?.requireTimeOverlap !== false;
  if (requireTimeOverlap) {
    const overlap = hasTimeOverlapSignal(myProfile, candidate);
    if (overlap.hasComparable && !overlap.hasOverlap) return false;
  }

  if (!withinSuggestionDistance(myProfile, candidate, opts)) return false;

  return true;
}

/**
 * Beregn matchmaking-score (0-100) for en kandidat.
 */
export function scoreCandidate(myProfile, candidate, opts = {}) {
  const eloByUserId = opts.eloByUserId || {};
  const gamesByUserId = opts.gamesByUserId || {};
  const inviteStatsByUserId = opts.inviteStatsByUserId || {};
  const exposureCountByUserId = opts.exposureCountByUserId || {};
  const pastMatchesByUserId = opts.pastMatchesByUserId || {};
  const favoriteIds = opts.favoriteIds || null;

  /* resolveEloWithContext bruger signup-niveau som proxy for nye spillere
     (<5 kampe), så cold-start ikke straffes urimeligt. */
  const myElo = resolveEloWithContext(myProfile, eloByUserId, gamesByUserId);
  const candidateElo = resolveEloWithContext(candidate, eloByUserId, gamesByUserId);

  const forward = directionalScore(myProfile, candidate, myElo, candidateElo);
  const reverse = directionalScore(candidate, myProfile, candidateElo, myElo);
  const reciprocalCore = Math.sqrt(forward.total01 * reverse.total01);

  const activity = lastActiveScore(candidate);
  const seekingRecency = seekingRecencyScore(candidate);
  const inviteStats = inviteStatsByUserId[String(candidate?.id || '')] || null;
  const inviteAdj = inviteAcceptanceAdjustment(inviteStats);
  const exposureCount = Number(exposureCountByUserId[String(candidate?.id || '')] || 0);
  const exposurePenaltyValue = exposurePenalty(exposureCount);
  const pastMatchesBoostValue = pastMatchesBoost(candidate?.id, pastMatchesByUserId);
  const favoriteBoostValue = favoriteBoost(candidate?.id, favoriteIds);
  const preferenceBoostValue = partnerPreferenceBoost(myProfile, myElo, candidateElo);

  let total01 = reciprocalCore;
  total01 += activity * 0.08;
  total01 += seekingRecency * 0.07;
  total01 += inviteAdj;
  total01 += pastMatchesBoostValue;
  total01 += favoriteBoostValue;
  total01 += preferenceBoostValue;
  total01 -= exposurePenaltyValue;
  total01 = clamp01(total01);

  const breakdown = {
    reciprocal: reciprocalCore,
    skill: (forward.components.skill + reverse.components.skill) / 2,
    time: (forward.components.time + reverse.components.time) / 2,
    geo: (forward.components.geo + reverse.components.geo) / 2,
    intent: (forward.components.intent + reverse.components.intent) / 2,
    courtSide: (forward.components.courtSide + reverse.components.courtSide) / 2,
    activity,
    seekingRecency,
    inviteAcceptanceAdjustment: inviteAdj,
    exposurePenalty: exposurePenaltyValue,
    exposureCount,
    pastMatchesBoost: pastMatchesBoostValue,
    favoriteBoost: favoriteBoostValue,
    partnerPreferenceBoost: preferenceBoostValue,
    inviteSentCount: Number(inviteStats?.sent || 0),
    inviteAcceptanceRate: Number.isFinite(inviteStats?.acceptanceRate)
      ? inviteStats.acceptanceRate
      : 0.5,
  };

  return {
    total: Math.round(total01 * 100),
    breakdown,
    /** Vises i UI — samme kilde som profil/liste (ikke cold-start-justeret score-ELO). */
    resolvedElo: resolveElo(candidate, eloByUserId),
  };
}

/**
 * Byg opblødningstrappen. Sætter kalderen selv en radius, respekteres den som
 * eneste trin — ellers udvides der automatisk indtil der er nok forslag.
 */
function relaxationStepsFor(opts) {
  const explicitDistance = limitOrNull(opts?.maxDistanceKm);
  const explicitElo = limitOrNull(opts?.maxEloDiff);
  if (explicitDistance != null || explicitElo != null) {
    return [
      {
        maxDistanceKm: explicitDistance != null ? explicitDistance : DEFAULTS.maxDistanceKm,
        maxEloDiff: explicitElo != null ? explicitElo : DEFAULTS.maxEloDiff,
        requireTimeOverlap: opts?.requireTimeOverlap !== false,
      },
    ];
  }
  return RELAXATION_LADDER;
}

/**
 * Filtrer og sorter spillere efter matchmaking-score.
 *
 * @returns {{ suggestions: object[], preferredRadiusKm: number, appliedRadiusKm: number, relaxed: boolean }}
 */
export function getMatchSuggestionsWithMeta(myProfile, candidates, opts = {}) {
  const {
    limit = 10,
    seekingOnly = false,
    eloByUserId = {},
    gamesByUserId = {},
    inviteStatsByUserId = {},
    exposureCountByUserId = {},
    pastMatchesByUserId = {},
    favoriteIds = null,
    minSuggestions = DEFAULTS.minSuggestions,
  } = opts;

  const myElo = resolveElo(myProfile, eloByUserId);
  const steps = relaxationStepsFor(opts);
  const preferredRadiusKm = steps[0].maxDistanceKm;

  const pool = candidates.filter((candidate) => {
    if (seekingOnly && !candidate?.seeking_match) return false;
    return true;
  });

  let filtered = [];
  let appliedStep = steps[0];
  for (const step of steps) {
    appliedStep = step;
    filtered = pool.filter((candidate) => {
      const candidateElo = resolveElo(candidate, eloByUserId);
      return passesHardFilters(myProfile, candidate, myElo, candidateElo, { ...opts, ...step });
    });
    if (filtered.length >= minSuggestions) break;
  }

  const myRegion = profileMatchRegion(myProfile);

  const scoreOpts = {
    ...opts,
    eloByUserId,
    gamesByUserId,
    inviteStatsByUserId,
    exposureCountByUserId,
    pastMatchesByUserId,
    favoriteIds,
  };

  const suggestions = filtered
    .map((candidate) => {
      const ranked = buildRankedCandidate(myProfile, candidate, scoreOpts, myRegion);
      return {
        ...ranked,
        beyondPreferredRadius: ranked.distanceKm != null && ranked.distanceKm > preferredRadiusKm,
      };
    })
    .sort((a, b) => compareRankedSuggestions(a, b, myRegion))
    .slice(0, limit);

  return {
    suggestions,
    preferredRadiusKm,
    appliedRadiusKm: appliedStep.maxDistanceKm,
    relaxed: appliedStep !== steps[0],
  };
}

/**
 * Bagudkompatibel indgang — returnerer kun listen.
 */
export function getMatchSuggestions(myProfile, candidates, opts = {}) {
  return getMatchSuggestionsWithMeta(myProfile, candidates, opts).suggestions;
}

/**
 * Ranger ALLE spillere efter sandsynligt makker-match.
 *
 * I modsætning til getMatchSuggestionsWithMeta:
 * - Ingen hard cut på afstand, ELO eller spilledage — fjerne spillere
 *   ligger længere nede, de skjules ikke.
 * - Banned og egen profil udelades. Inaktive vises, men scorer lavere.
 * - Sortering: afstandsbånd → samme region → score.
 */
export function rankMakkerSearchResults(myProfile, candidates, opts = {}) {
  const {
    eloByUserId = {},
    gamesByUserId = {},
    inviteStatsByUserId = {},
    exposureCountByUserId = {},
    pastMatchesByUserId = {},
    favoriteIds = null,
  } = opts;

  const myRegion = profileMatchRegion(myProfile);
  const scoreOpts = {
    ...opts,
    eloByUserId,
    gamesByUserId,
    inviteStatsByUserId,
    exposureCountByUserId,
    pastMatchesByUserId,
    favoriteIds,
  };

  return (candidates || [])
    .filter((candidate) => {
      if (!candidate || candidate.id === myProfile?.id) return false;
      if (candidate.is_banned) return false;
      return true;
    })
    .map((candidate) => buildRankedCandidate(myProfile, candidate, scoreOpts, myRegion))
    .sort((a, b) => compareRankedSuggestions(a, b, myRegion));
}

/**
 * Læsbar forklaring på hvorfor en spiller er foreslået.
 */
export function matchReason(breakdown, candidate, myProfile = null) {
  const reasons = [];
  if ((breakdown?.favoriteBoost || 0) > 0) reasons.push('⭐ Favorit');
  if ((breakdown?.pastMatchesBoost || 0) >= 0.05) reasons.push('Spillet sammen før');
  const km = distanceKmBetweenProfiles(myProfile, candidate);
  if (km != null && km <= 30) reasons.push('Tæt på dig');
  else if (km != null && km <= 60) reasons.push('I nærheden');
  else if (km != null) reasons.push(`${Math.round(km)} km væk`);
  else {
    const myRegion = profileMatchRegion(myProfile);
    const theirRegion = profileMatchRegion(candidate);
    if (myRegion && theirRegion && myRegion === theirRegion) reasons.push('Samme region');
    else if ((breakdown?.geo || 0) >= 0.75) reasons.push('Tæt på dig');
  }
  if ((breakdown?.reciprocal || 0) >= 0.75) reasons.push('Gensidig match');
  if ((breakdown?.skill || 0) >= 0.8) reasons.push('Tæt ELO-niveau');
  if ((breakdown?.time || 0) >= 0.75) reasons.push('Samme spilledage');
  if ((breakdown?.intent || 0) >= 0.8) reasons.push('Samme intention');
  if ((breakdown?.courtSide || 0) >= 0.95) reasons.push('Komplementær side');
  if ((breakdown?.activity || 0) >= 0.75) reasons.push('Aktiv spiller');
  if ((breakdown?.seekingRecency || 0) >= 0.7 || candidate?.seeking_match) reasons.push('Søger kamp nu');
  if ((breakdown?.inviteAcceptanceAdjustment || 0) >= 0.02) reasons.push('God respons-rate');
  if (reasons.length === 0) reasons.push('God match');
  return reasons.join(' · ');
}
