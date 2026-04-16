/**
 * Matchmaking scoring v1
 *
 * Vægte:
 *   35% skill  — ELO-forskel
 *   25% tid    — overlappende tilgængelighed
 *   25% geo    — afstand (km) eller regions-match
 *   15% intent — fælles spilleintention
 *
 * Hard filters (fjernes før scoring):
 *   - is_banned
 *   - last_active_at > 14 dage siden (eller null på nye installationer)
 *   - samme bruger som den der søger
 */

const INACTIVE_DAYS = 14;

// ----- Skill score (35%) -----

/**
 * Returnerer 0–1 baseret på ELO-forskel.
 * Perfekt match = 0 forskel → 1.0
 * ±100 → ~0.75, ±200 → ~0.50, ±400+ → 0
 */
function skillScore(myElo, theirElo) {
  const diff = Math.abs((myElo || 1000) - (theirElo || 1000));
  return Math.max(0, 1 - diff / 400);
}

// ----- Tid / tilgængelighed score (25%) -----

/**
 * Overlap af tilgængeligheds-arrays (fx ["Aftener", "Weekender"]).
 * Ingen data på begge → neutral (0.5), fuld overlap → 1.0, ingen overlap → 0.
 */
function timeScore(myAvail, theirAvail) {
  const mine = Array.isArray(myAvail) ? myAvail : [];
  const theirs = Array.isArray(theirAvail) ? theirAvail : [];
  if (mine.length === 0 || theirs.length === 0) return 0.5;
  const intersection = mine.filter((t) => theirs.includes(t));
  const union = new Set([...mine, ...theirs]);
  return intersection.length / union.size;
}

// ----- Geo score (25%) -----

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

/**
 * Returnerer 0–1 baseret på afstand.
 * < 10 km → 1.0, 10–30 km → 0.75, 30–60 km → 0.4, > 60 km → 0.1
 * Hvis koordinater mangler: faldt tilbage på region-match (0.6 match / 0.2 forskellig)
 */
function geoScore(myProfile, theirProfile) {
  const hasCoords =
    myProfile.latitude != null &&
    myProfile.longitude != null &&
    theirProfile.latitude != null &&
    theirProfile.longitude != null;

  if (hasCoords) {
    const km = haversineKm(
      myProfile.latitude,
      myProfile.longitude,
      theirProfile.latitude,
      theirProfile.longitude
    );
    if (km <= 10) return 1.0;
    if (km <= 30) return 0.75;
    if (km <= 60) return 0.4;
    return Math.max(0.05, 0.1 - (km - 60) / 200);
  }

  // Fallback: region
  if (!myProfile.area || !theirProfile.area) return 0.4;
  return myProfile.area === theirProfile.area ? 0.6 : 0.15;
}

// ----- Court side score (10%) -----

/**
 * Komplementære sider = god match (1.0), samme side = svag match (0.35),
 * "Begge sider" eller uudfyldt = neutral (0.6).
 */
function courtSideScore(mySide, theirSide) {
  if (!mySide || !theirSide) return 0.6;
  if (mySide === 'Begge sider' || theirSide === 'Begge sider') return 0.6;
  const complementary =
    (mySide === 'Venstre side' && theirSide === 'Højre side') ||
    (mySide === 'Højre side' && theirSide === 'Venstre side');
  return complementary ? 1.0 : 0.35;
}

// ----- Intent score (13%) -----

/**
 * Kompatibilitetsmatrix for intent_now.
 * Returnerer 0–1.
 */
const INTENT_COMPAT = {
  konkurrence: { konkurrence: 1.0, træning: 0.6, hygge: 0.2, fast_makker: 0.5, turnering: 0.8 },
  træning:     { konkurrence: 0.6, træning: 1.0, hygge: 0.5, fast_makker: 0.7, turnering: 0.5 },
  hygge:       { konkurrence: 0.2, træning: 0.5, hygge: 1.0, fast_makker: 0.8, turnering: 0.3 },
  fast_makker: { konkurrence: 0.5, træning: 0.7, hygge: 0.8, fast_makker: 1.0, turnering: 0.4 },
  turnering:   { konkurrence: 0.8, træning: 0.5, hygge: 0.3, fast_makker: 0.4, turnering: 1.0 },
};

function intentScore(myIntent, theirIntent) {
  if (!myIntent || !theirIntent) return 0.5; // neutral hvis uudfyldt
  const row = INTENT_COMPAT[myIntent];
  if (!row) return 0.5;
  return row[theirIntent] ?? 0.5;
}

// ----- Hard filter -----

function isActive(profile) {
  if (!profile.last_active_at) return true; // ny installation: antag aktiv
  const lastActive = new Date(profile.last_active_at);
  const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  return lastActive >= cutoff;
}

// ----- Samlet scoring -----

const WEIGHTS = {
  skill:     0.32,
  time:      0.23,
  geo:       0.22,
  intent:    0.13,
  courtSide: 0.10,
};

/**
 * Beregn matchmaking-score (0–100) for én kandidat.
 * @param {object} myProfile  - den indloggede brugers profil
 * @param {object} candidate  - en anden spillers profil
 * @returns {{ total: number, breakdown: object }}
 */
export function scoreCandidate(myProfile, candidate) {
  const myElo   = Math.round(Number(myProfile.elo_rating) || 1000);
  const theirElo = Math.round(Number(candidate.elo_rating) || 1000);

  const scores = {
    skill:     skillScore(myElo, theirElo),
    time:      timeScore(myProfile.availability, candidate.availability),
    geo:       geoScore(myProfile, candidate),
    intent:    intentScore(myProfile.intent_now, candidate.intent_now),
    courtSide: courtSideScore(myProfile.court_side, candidate.court_side),
  };

  const total = Math.round(
    (scores.skill     * WEIGHTS.skill     +
     scores.time      * WEIGHTS.time      +
     scores.geo       * WEIGHTS.geo       +
     scores.intent    * WEIGHTS.intent    +
     scores.courtSide * WEIGHTS.courtSide) * 100
  );

  return { total, breakdown: scores };
}

/**
 * Filtrer og sorter en liste af spillere efter matchmaking-score.
 * Returnerer de bedste `limit` kandidater.
 *
 * @param {object}   myProfile   - den indloggede brugers profil
 * @param {object[]} candidates  - alle andre spillere (råt fra DB)
 * @param {object}   opts
 * @param {number}   [opts.limit=10]         - maks antal forslag
 * @param {boolean}  [opts.seekingOnly=false] - vis kun seeking_match=true spillere
 * @returns {{ profile: object, score: number, breakdown: object }[]}
 */
export function getMatchSuggestions(myProfile, candidates, opts = {}) {
  const { limit = 10, seekingOnly = false } = opts;

  const filtered = candidates.filter((c) => {
    if (c.id === myProfile.id) return false;
    if (c.is_banned) return false;
    if (!isActive(c)) return false;
    if (seekingOnly && !c.seeking_match) return false;
    return true;
  });

  return filtered
    .map((c) => {
      const { total, breakdown } = scoreCandidate(myProfile, c);
      return { profile: c, score: total, breakdown };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Læsbar forklaring på hvorfor en spiller er foreslået.
 * Bruges som subtitle i UI.
 */
export function matchReason(breakdown, candidate) {
  const reasons = [];
  if (breakdown.skill >= 0.8)      reasons.push('Tæt ELO-niveau');
  if (breakdown.geo   >= 0.75)     reasons.push('Tæt på dig');
  if (breakdown.time  >= 0.75)     reasons.push('Samme tider');
  if (breakdown.intent >= 0.8)     reasons.push('Samme intention');
  if (breakdown.courtSide >= 0.95) reasons.push('Komplementær side');
  if (candidate.seeking_match)     reasons.push('Søger kamp nu');
  if (reasons.length === 0)        reasons.push('God match');
  return reasons.join(' · ');
}
