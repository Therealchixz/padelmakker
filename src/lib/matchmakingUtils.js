/**
 * Matchmaking scoring v2
 *
 * Fokus:
 * - Reciprocal score (begge parter skal passe sammen)
 * - Hard filters for tydelig mismatch
 * - Recency/aktivitet boost
 * - Lokal fairness via exposure penalty (samme profiler vises ikke konstant)
 */

const INACTIVE_DAYS = 14;
const SEEKING_FRESH_HOURS = 24;

const DIRECTIONAL_WEIGHTS = {
  skill: 0.32,
  time: 0.23,
  geo: 0.22,
  intent: 0.13,
  courtSide: 0.1,
};

const DEFAULTS = {
  maxEloDiff: 260,
  requireTimeOverlap: true,
};

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
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

function resolveElo(profile, eloByUserId = {}) {
  const key = String(profile?.id || '');
  const fromMap = toNumber(eloByUserId[key], NaN);
  if (Number.isFinite(fromMap)) return Math.round(fromMap);
  return Math.round(toNumber(profile?.elo_rating, 1000));
}

function skillScore(myElo, theirElo) {
  const diff = Math.abs(toNumber(myElo, 1000) - toNumber(theirElo, 1000));
  return clamp01(1 - diff / 400);
}

function timeScore(myProfile, theirProfile) {
  const myDays = normalizedList(myProfile?.available_days);
  const theirDays = normalizedList(theirProfile?.available_days);
  const myAvail = normalizedList(myProfile?.availability);
  const theirAvail = normalizedList(theirProfile?.availability);

  const hasDays = myDays.length > 0 && theirDays.length > 0;
  const hasAvail = myAvail.length > 0 && theirAvail.length > 0;

  if (!hasDays && !hasAvail) return 0.5;
  if (hasDays && !hasAvail) return jaccardOverlap(myDays, theirDays);
  if (!hasDays && hasAvail) return jaccardOverlap(myAvail, theirAvail);

  return 0.6 * jaccardOverlap(myDays, theirDays) + 0.4 * jaccardOverlap(myAvail, theirAvail);
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

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geoScore(myProfile, theirProfile) {
  const hasCoords =
    myProfile?.latitude != null &&
    myProfile?.longitude != null &&
    theirProfile?.latitude != null &&
    theirProfile?.longitude != null;

  if (hasCoords) {
    const km = haversineKm(
      toNumber(myProfile.latitude),
      toNumber(myProfile.longitude),
      toNumber(theirProfile.latitude),
      toNumber(theirProfile.longitude)
    );
    if (km <= 10) return 1.0;
    if (km <= 30) return 0.75;
    if (km <= 60) return 0.4;
    return Math.max(0.05, 0.1 - (km - 60) / 200);
  }

  const myArea = normalizeText(myProfile?.area);
  const theirArea = normalizeText(theirProfile?.area);
  if (!myArea || !theirArea) return 0.4;
  return myArea === theirArea ? 0.6 : 0.15;
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

  if (!mine || !theirs) return 0.6;
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
  if (!mine || !theirs) return 0.5;
  const row = INTENT_COMPAT[mine];
  if (!row) return 0.5;
  return row[theirs] ?? 0.5;
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
    skill: skillScore(fromElo, toElo),
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

function passesHardFilters(myProfile, candidate, myElo, candidateElo, opts) {
  if (candidate?.id === myProfile?.id) return false;
  if (candidate?.is_banned) return false;
  if (!isActive(candidate)) return false;

  const maxEloDiff = Number.isFinite(opts?.maxEloDiff) ? Number(opts.maxEloDiff) : DEFAULTS.maxEloDiff;
  if (Math.abs(myElo - candidateElo) > maxEloDiff) return false;

  const requireTimeOverlap = opts?.requireTimeOverlap !== false;
  if (requireTimeOverlap) {
    const overlap = hasTimeOverlapSignal(myProfile, candidate);
    if (overlap.hasComparable && !overlap.hasOverlap) return false;
  }

  return true;
}

/**
 * Beregn matchmaking-score (0-100) for en kandidat.
 */
export function scoreCandidate(myProfile, candidate, opts = {}) {
  const eloByUserId = opts.eloByUserId || {};
  const inviteStatsByUserId = opts.inviteStatsByUserId || {};
  const exposureCountByUserId = opts.exposureCountByUserId || {};

  const myElo = resolveElo(myProfile, eloByUserId);
  const candidateElo = resolveElo(candidate, eloByUserId);

  const forward = directionalScore(myProfile, candidate, myElo, candidateElo);
  const reverse = directionalScore(candidate, myProfile, candidateElo, myElo);
  const reciprocalCore = Math.sqrt(forward.total01 * reverse.total01);

  const activity = lastActiveScore(candidate);
  const seekingRecency = seekingRecencyScore(candidate);
  const inviteStats = inviteStatsByUserId[String(candidate?.id || '')] || null;
  const inviteAdj = inviteAcceptanceAdjustment(inviteStats);
  const exposureCount = Number(exposureCountByUserId[String(candidate?.id || '')] || 0);
  const exposurePenaltyValue = exposurePenalty(exposureCount);

  let total01 = reciprocalCore;
  total01 += activity * 0.08;
  total01 += seekingRecency * 0.07;
  total01 += inviteAdj;
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
    inviteSentCount: Number(inviteStats?.sent || 0),
    inviteAcceptanceRate: Number.isFinite(inviteStats?.acceptanceRate)
      ? inviteStats.acceptanceRate
      : 0.5,
  };

  return {
    total: Math.round(total01 * 100),
    breakdown,
    resolvedElo: candidateElo,
  };
}

/**
 * Filtrer og sorter spillere efter matchmaking-score.
 */
export function getMatchSuggestions(myProfile, candidates, opts = {}) {
  const {
    limit = 10,
    seekingOnly = false,
    eloByUserId = {},
    inviteStatsByUserId = {},
    exposureCountByUserId = {},
  } = opts;

  const myElo = resolveElo(myProfile, eloByUserId);

  const filtered = candidates.filter((candidate) => {
    if (seekingOnly && !candidate?.seeking_match) return false;
    const candidateElo = resolveElo(candidate, eloByUserId);
    return passesHardFilters(myProfile, candidate, myElo, candidateElo, opts);
  });

  return filtered
    .map((candidate) => {
      const score = scoreCandidate(myProfile, candidate, {
        ...opts,
        eloByUserId,
        inviteStatsByUserId,
        exposureCountByUserId,
      });
      return {
        profile: candidate,
        score: score.total,
        breakdown: score.breakdown,
        resolvedElo: score.resolvedElo,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aExposure = Number(a.breakdown?.exposureCount || 0);
      const bExposure = Number(b.breakdown?.exposureCount || 0);
      if (aExposure !== bExposure) return aExposure - bExposure;
      return String(a.profile?.id || '').localeCompare(String(b.profile?.id || ''));
    })
    .slice(0, limit);
}

/**
 * Laesbar forklaring paa hvorfor en spiller er foreslaaet.
 */
export function matchReason(breakdown, candidate) {
  const reasons = [];
  if ((breakdown?.reciprocal || 0) >= 0.75) reasons.push('Gensidig match');
  if ((breakdown?.skill || 0) >= 0.8) reasons.push('Taet ELO-niveau');
  if ((breakdown?.time || 0) >= 0.75) reasons.push('Samme spilledage');
  if ((breakdown?.intent || 0) >= 0.8) reasons.push('Samme intention');
  if ((breakdown?.courtSide || 0) >= 0.95) reasons.push('Komplementaer side');
  if ((breakdown?.activity || 0) >= 0.75) reasons.push('Aktiv spiller');
  if ((breakdown?.seekingRecency || 0) >= 0.7 || candidate?.seeking_match) reasons.push('Soger kamp nu');
  if ((breakdown?.inviteAcceptanceAdjustment || 0) >= 0.02) reasons.push('God respons-rate');
  if (reasons.length === 0) reasons.push('God match');
  return reasons.join(' · ');
}
