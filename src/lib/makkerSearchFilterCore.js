/**
 * Mit makker-filter — ren logik (ingen Supabase-import).
 */

import {
  seekingVisibilityPhrase,
  INTENTS,
  PLAY_STYLES,
  AVAILABILITY,
  INTENT_LABELS,
  intentDisplayLabel,
} from './platformConstants.js';
import { canonicalRegionForForm, normalizeStringArrayField } from './profileUtils.js';
import {
  profilePlaytomicLevel,
  migrateEloWindowToLevelWindow,
  formatPlaytomicLevel,
} from './padelLevelUtils.js';
import {
  DEFAULT_LEVEL_WINDOW,
  LEVEL_WINDOW_CHOICES,
  LEVEL_WINDOW_OPTIONS,
} from './matchSearchFilterCore.js';
import {
  isSeekingActiveProfile,
  mergeFeedVisibleSince,
  resolveSeekingMatchAtForProfile,
  resolveSeekingMatchVisible,
} from './seekingFeedTtl.js';
import {
  normalizeMakkerFilterExtras,
  levelRangeForMakkerPartnerPref,
  makkerFilterLevelBounds,
  subjectPassesMakkerLevelFilter,
  courtSideMatchesMakkerFilter,
  playStyleMatchesMakkerFilter,
  intentMatchesMakkerFilter,
  availabilityMatchesMakkerFilter,
  availabilityMeansAllTimeSlots,
  partnerCourtSideLabel,
  MAKKER_PARTNER_COURT_SIDES,
  MAKKER_COURT_SIDE_MODES,
  MAKKER_INTENT_MODES,
  MAKKER_PARTNER_LEVEL_FILTERS,
} from './makkerFilterMatch.js';

export {
  DEFAULT_LEVEL_WINDOW,
  LEVEL_WINDOW_CHOICES,
  LEVEL_WINDOW_OPTIONS,
  MAKKER_PARTNER_COURT_SIDES,
  MAKKER_COURT_SIDE_MODES,
  MAKKER_INTENT_MODES,
  MAKKER_PARTNER_LEVEL_FILTERS,
  levelRangeForMakkerPartnerPref,
  makkerFilterLevelBounds,
  INTENTS,
  PLAY_STYLES,
  AVAILABILITY,
  INTENT_LABELS,
};

export const MAKKER_FILTER_PREFS_VERSION = 2;

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export { isSeekingActiveProfile };

export function defaultMakkerSearchPrefs(profile = {}) {
  const region = canonicalRegionForForm(profile.area) || profile.area || '';
  const days = normalizeStringArrayField(profile.available_days);
  const extras = normalizeMakkerFilterExtras({}, profile);
  return {
    version: MAKKER_FILTER_PREFS_VERSION,
    notify: false,
    feedVisible: false,
    region: region || '',
    myLevel: profilePlaytomicLevel(profile),
    levelWindow: DEFAULT_LEVEL_WINDOW,
    days,
    ...extras,
  };
}

export function normalizeMakkerSearchPrefs(raw, profile = {}) {
  const base = defaultMakkerSearchPrefs(profile);
  let parsed = raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    parsed = {};
  }

  const region = canonicalRegionForForm(parsed.region) || parsed.region || base.region;
  const days = normalizeStringArrayField(parsed.days).filter((d) => DAY_KEYS.includes(d));

  let levelWindow = Number(parsed.levelWindow);
  if (!Number.isFinite(levelWindow) && parsed.eloWindow != null) {
    levelWindow = migrateEloWindowToLevelWindow(parsed.eloWindow);
  }
  if (!Number.isFinite(levelWindow) || levelWindow < 0.1 || levelWindow > 0.5) {
    levelWindow = levelWindow > 0.5 ? 0.5 : base.levelWindow;
  }
  levelWindow = Math.round(levelWindow * 10) / 10;
  if (!LEVEL_WINDOW_OPTIONS.includes(levelWindow)) {
    const nearest = LEVEL_WINDOW_OPTIONS.reduce((best, v) =>
      (Math.abs(v - levelWindow) < Math.abs(best - levelWindow) ? v : best), DEFAULT_LEVEL_WINDOW);
    levelWindow = nearest;
  }

  let myLevel = Number(parsed.myLevel);
  if (!Number.isFinite(myLevel) || myLevel < 1 || myLevel > 7) {
    myLevel = profilePlaytomicLevel(profile);
  } else {
    myLevel = Math.round(myLevel * 10) / 10;
  }

  const notify = parsed.notify === true
    || (parsed.notify == null && profile.makker_watch_enabled === true && Object.keys(parsed).length === 0);

  const feedVisible = parsed.feedVisible === true;
  const feedVisibleSince = typeof parsed.feedVisibleSince === 'string' && parsed.feedVisibleSince.trim()
    ? parsed.feedVisibleSince.trim()
    : null;
  const extras = normalizeMakkerFilterExtras(parsed, profile);

  return {
    version: MAKKER_FILTER_PREFS_VERSION,
    notify,
    feedVisible,
    feedVisibleSince,
    region: region || '',
    myLevel,
    levelWindow,
    days,
    ...extras,
  };
}

export function resolveMakkerFilterRegion(prefs, profile = {}) {
  const fromPrefs = canonicalRegionForForm(prefs?.region) || (prefs?.region ? String(prefs.region).trim() : '');
  if (fromPrefs) return fromPrefs;
  return canonicalRegionForForm(profile.area) || profile.area || '';
}

export function resolveMakkerFilterLevel(prefs, profile = {}) {
  if (profile?.level != null && profile.level !== '') {
    return profilePlaytomicLevel(profile);
  }
  const n = Number(prefs?.myLevel);
  if (Number.isFinite(n) && n >= 1 && n <= 7) return Math.round(n * 10) / 10;
  return profilePlaytomicLevel(profile);
}

export function isMakkerFilterConfigured(prefs, profile = {}) {
  return Boolean(resolveMakkerFilterRegion(prefs, profile));
}

export function isMakkerFilterActive(prefs, profile = {}) {
  if (!isMakkerFilterConfigured(prefs, profile)) return false;
  return Boolean(prefs.notify || prefs.feedVisible);
}

export function daysOverlap(watcherDays, subjectDays) {
  const w = normalizeStringArrayField(watcherDays);
  if (w.length === 0) return true;
  const s = normalizeStringArrayField(subjectDays);
  if (s.length === 0) return true;
  return w.some((d) => s.includes(d));
}

/**
 * Matcher en profil mod makker-filteret UDEN at kræve at de søger lige nu.
 * Bruges til notifikationer. Listen på Find makker rangerer alle spillere
 * og skjuler ikke ud fra denne ramme.
 *
 * @param {{ ignoreRegion?: boolean }} [opts] ignoreRegion: behold spillere
 *   i andre regioner — afstand rangeres i UI i stedet for at skjule dem.
 */
export function profileMatchesMakkerFilter(subjectProfile, prefs, watcherProfile, watcherUserId, opts = {}) {
  if (!subjectProfile || !isMakkerFilterConfigured(prefs, watcherProfile)) return false;
  if (watcherUserId && String(subjectProfile.id) === String(watcherUserId)) return false;

  if (!opts.ignoreRegion) {
    const filterRegion = resolveMakkerFilterRegion(prefs, watcherProfile);
    const subjectRegion = canonicalRegionForForm(subjectProfile?.area) || subjectProfile?.area || '';
    if (filterRegion && subjectRegion && filterRegion.toLowerCase() !== subjectRegion.toLowerCase()) {
      return false;
    }
  }

  const myLevel = resolveMakkerFilterLevel(prefs, watcherProfile);
  const levelWindow = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  if (!subjectPassesMakkerLevelFilter(myLevel, levelWindow, prefs.partnerLevel, watcherProfile, subjectProfile, prefs)) {
    return false;
  }

  if (!daysOverlap(prefs.days, subjectProfile.available_days)) return false;
  if (!availabilityMatchesMakkerFilter(prefs.availability, subjectProfile.availability)) return false;
  if (!playStyleMatchesMakkerFilter(prefs.playStyle, subjectProfile.play_style)) return false;
  if (!intentMatchesMakkerFilter(prefs.intents, prefs.intentMode, subjectProfile.intent_now)) return false;
  if (!courtSideMatchesMakkerFilter(prefs.partnerCourtSide, subjectProfile.court_side)) return false;

  return true;
}

/**
 * Tidligere søgeramme til listen. Beholdt til notifikationer og tests;
 * Find makker skjuler ikke længere spillere med den.
 */
export function profileFitsMakkerSearchFrame(subjectProfile, prefs, watcherProfile, watcherUserId) {
  return profileMatchesMakkerFilter(subjectProfile, prefs, watcherProfile, watcherUserId, { ignoreRegion: true });
}

export function seekingProfileMatchesFilter(subjectProfile, prefs, watcherProfile, watcherUserId) {
  if (!subjectProfile || !isSeekingActiveProfile(subjectProfile)) return false;
  return profileMatchesMakkerFilter(subjectProfile, prefs, watcherProfile, watcherUserId);
}

/**
 * Hvad filteret gør lige nu, i hverdagssprog (før: "notifikationer + synlig …"
 * eller "ingen kanal aktiv").
 */
function describeSeekingChannels(prefs, noun, channel) {
  const visible = `synlig for andre ${seekingVisibilityPhrase(channel)}`;
  if (prefs.notify && prefs.feedVisible) return `Du får besked om nye ${noun} og er ${visible}.`;
  if (prefs.notify) return `Du får besked om nye ${noun}.`;
  if (prefs.feedVisible) return `Du er ${visible}, men får ingen besked om nye ${noun}.`;
  return `Slået fra: du får ingen besked om nye ${noun} og er ikke synlig for andre.`;
}

export function describeMakkerFilter(prefs, profile = {}) {
  if (!isMakkerFilterConfigured(prefs, profile)) {
    return { configured: false, summary: 'Ikke sat op', detail: 'Vælg region og gem dit filter.' };
  }
  const parts = [];
  const region = resolveMakkerFilterRegion(prefs, profile);
  if (region) parts.push(region.replace(/^Region /, ''));
  const lvl = resolveMakkerFilterLevel(prefs, profile);
  const { min, max } = makkerFilterLevelBounds(prefs, lvl, profile);
  parts.push(min <= 1 && max >= 7
    ? 'Alle niveauer'
    : `Niveau ${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`);

  if (prefs.playStyle && prefs.playStyle !== 'all') parts.push(prefs.playStyle);
  if (normalizeStringArrayField(prefs.intents).length > 0) {
    const labels = normalizeStringArrayField(prefs.intents)
      .map((k) => intentDisplayLabel(k))
      .slice(0, 2);
    parts.push(labels.join(', ') + (prefs.intents.length > 2 ? '…' : ''));
  }
  // "Ligegyldigt" alene i opsummeringen siger ikke, hvad det handler om.
  if (prefs.partnerCourtSide && prefs.partnerCourtSide !== 'any') {
    parts.push(partnerCourtSideLabel(prefs.partnerCourtSide));
  }

  const days = normalizeStringArrayField(prefs.days);
  if (days.length > 0) parts.push(`${days.length} ${days.length === 1 ? 'dag' : 'dage'}`);
  if (!availabilityMeansAllTimeSlots(prefs.availability)) {
    const avail = normalizeStringArrayField(prefs.availability);
    if (avail.length > 0) parts.push(`${avail.length} tidsrum`);
  }

  const channelText = describeSeekingChannels(prefs, 'makkere', 'makker');
  return {
    configured: true,
    summary: parts.join(' · '),
    detail: channelText,
    active: isMakkerFilterActive(prefs, profile),
  };
}

export function buildProfilePatchFromMakkerSearchPrefs(prefs, profile = {}) {
  const prev = normalizeMakkerSearchPrefs(profile?.makker_search_prefs, profile);
  const normalized = normalizeMakkerSearchPrefs(prefs, profile);
  const feedVisibleSince = mergeFeedVisibleSince(normalized, prev, profile);
  const configured = isMakkerFilterConfigured(normalized, profile);
  const notifyOn = configured && normalized.notify;
  const region = resolveMakkerFilterRegion(normalized, profile);
  const prefsOut = {
    ...normalized,
    feedVisibleSince,
    version: MAKKER_FILTER_PREFS_VERSION,
    region: region || normalized.region,
    myLevel: profilePlaytomicLevel(profile),
  };
  const feedOn = resolveSeekingMatchVisible(profile?.match_search_prefs, prefsOut, profile);
  const seekingAt = resolveSeekingMatchAtForProfile(profile?.match_search_prefs, prefsOut, profile);

  return {
    makker_search_prefs: prefsOut,
    makker_watch_enabled: notifyOn,
    // Tidspunktet registrerer HVORNAAR brugeren tog stilling - ikke hvornaar de
    // sagde ja. Sattes det til null ved fravalg, var "har slaaet fra" umuligt at
    // skelne fra "har aldrig rørt den", og et fremtidigt standardvalg ville slaa
    // det til igen for nogen, der bevidst havde slaaet det fra.
    makker_watch_at: new Date().toISOString(),
    seeking_match: feedOn,
    seeking_match_at: seekingAt,
    ...(region && region !== profile.area ? { area: region } : {}),
  };
}
