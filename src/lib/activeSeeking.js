/**
 * Aktiv søgning — én switch pr. kanal (synlighed + notifikationer).
 * Bygger på eksisterende makker/match_search_prefs uden ny backend.
 */

import { canonicalRegionForForm, normalizeStringArrayField } from './profileUtils.js';
import {
  normalizeMakkerSearchPrefs,
  buildProfilePatchFromMakkerSearchPrefs,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
  isMakkerFilterConfigured,
} from './makkerSearchFilterCore.js';
import {
  normalizeMatchSearchPrefs,
  buildProfilePatchFromMatchSearchPrefs,
  resolveFilterRegion,
  resolveFilterLevel,
  isMatchFilterConfigured,
  DEFAULT_LEVEL_WINDOW,
} from './matchSearchFilterCore.js';
import {
  isProfileMakkerFeedVisible,
  isProfileMatchFeedVisible,
  channelFeedSince,
  isChannelFeedWithinTtl,
  seekingAvailabilitySummary,
} from './seekingFeedTtl.js';
import {
  SEEK_KAMP_TTL_MS,
  SEEK_MAKKER_TTL_MS,
  seekingVisibleDurationLabel,
  DAYS_OF_WEEK,
  intentDisplayLabel,
} from './platformConstants.js';
import { formatPlaytomicLevel, levelRangeForWindow } from './padelLevelUtils.js';
import {
  levelRangeForMakkerPartnerPref,
  partnerCourtSideLabel,
} from './makkerFilterMatch.js';

/** @typedef {'makker' | 'kamp'} SeekingChannel */

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function normalizeChannelPrefs(user, channel) {
  return channel === 'kamp'
    ? normalizeMatchSearchPrefs(user?.match_search_prefs, user)
    : normalizeMakkerSearchPrefs(user?.makker_search_prefs, user);
}

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function hasSeekingRegion(user, channel) {
  if (channel === 'kamp') {
    const prefs = normalizeMatchSearchPrefs(user?.match_search_prefs, user);
    return Boolean(resolveFilterRegion(prefs, user));
  }
  const prefs = normalizeMakkerSearchPrefs(user?.makker_search_prefs, user);
  return Boolean(resolveMakkerFilterRegion(prefs, user));
}

/**
 * Prefs siger ON (feedVisible + notify) — uafhængigt af TTL.
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function isCombinedSeekingEnabled(user, channel) {
  const prefs = normalizeChannelPrefs(user, channel);
  return Boolean(prefs.feedVisible && prefs.notify);
}

/**
 * Faktisk aktiv i UI: prefs ON og feed inden for TTL.
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function isSeekingUiActive(user, channel) {
  if (!isCombinedSeekingEnabled(user, channel)) return false;
  return isChannelFeedLive(user, channel);
}

/**
 * Prefs siger synlig, men TTL er udløbet.
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function isSeekingTtlExpired(user, channel) {
  const prefs = normalizeChannelPrefs(user, channel);
  if (!prefs.feedVisible) return false;
  return !isChannelFeedLive(user, channel);
}

/**
 * Feed-synlighed inden for TTL (andre kan se dig i feed/liste).
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function isChannelFeedLive(user, channel) {
  if (!user) return false;
  return channel === 'kamp'
    ? isProfileMatchFeedVisible(user)
    : isProfileMakkerFeedVisible(user);
}

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 */
function channelTtlMs(channel) {
  return channel === 'kamp' ? SEEK_KAMP_TTL_MS : SEEK_MAKKER_TTL_MS;
}

/**
 * Millisekunder til feed-TTL udløber; null hvis ikke feedVisible eller uden since.
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function seekingTtlRemainingMs(user, channel) {
  const prefs = normalizeChannelPrefs(user, channel);
  if (!prefs.feedVisible) return null;
  const since = channelFeedSince(prefs, user?.seeking_match_at);
  if (since == null) return null;
  const remaining = channelTtlMs(channel) - (Date.now() - since);
  if (!isChannelFeedWithinTtl(since, channelTtlMs(channel))) return 0;
  return Math.max(0, remaining);
}

/**
 * @param {number} ms
 */
export function formatSeekingTtlRemaining(ms) {
  if (ms == null || ms <= 0) return 'udløbet';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours} ${hours === 1 ? 'time' : 'timer'} tilbage`;
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return `${days} ${days === 1 ? 'dag' : 'dage'} tilbage`;
}

/**
 * Nedtælling til visuelt UI — adskilt fra filter-tekst.
 * @param {number | null} ms
 * @returns {{ value: string | null, unit: string | null, ariaLabel: string }}
 */
export function formatSeekingTtlCountdown(ms) {
  if (ms == null || ms <= 0) {
    return { value: null, unit: null, ariaLabel: 'Udløbet' };
  }
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 24) {
    const unit = hours === 1 ? 'time' : 'timer';
    return { value: String(hours), unit, ariaLabel: `${hours} ${unit} tilbage` };
  }
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  const unit = days === 1 ? 'dag' : 'dage';
  return { value: String(days), unit, ariaLabel: `${days} ${unit} tilbage` };
}

function formatSeekingDaysLine(prefs) {
  const keys = normalizeStringArrayField(prefs.days);
  if (!keys.length) return null;
  return keys
    .map((k) => DAYS_OF_WEEK.find((d) => d.key === k)?.label || k)
    .join(', ');
}

/**
 * Filterlinje til aktiv søgning — kun søgekriterier (ikke eget niveau eller TTL).
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function buildActiveSeekingFilterSummary(user, channel) {
  const prefs = normalizeChannelPrefs(user, channel);

  if (channel === 'kamp') {
    if (!isMatchFilterConfigured(prefs, user)) return 'Vælg region';
    const parts = [];
    const region = resolveFilterRegion(prefs, user);
    if (region) parts.push(region.replace(/^Region /, ''));
    const lvl = resolveFilterLevel(prefs, user);
    const win = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
    const { min, max } = levelRangeForWindow(lvl, win);
    parts.push(`Niveau ${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`);
    const days = formatSeekingDaysLine(prefs);
    if (days) parts.push(days);
    parts.push(seekingAvailabilitySummary(prefs));
    return parts.join(' · ');
  }

  if (!isMakkerFilterConfigured(prefs, user)) return 'Vælg region';
  const parts = [];
  const region = resolveMakkerFilterRegion(prefs, user);
  if (region) parts.push(region.replace(/^Region /, ''));
  const lvl = resolveMakkerFilterLevel(prefs, user);
  const win = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const { min, max } = levelRangeForMakkerPartnerPref(lvl, win, prefs.partnerLevel, user);
  parts.push(`Niveau ${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`);
  if (prefs.playStyle && prefs.playStyle !== 'all') parts.push(prefs.playStyle);
  const intents = normalizeStringArrayField(prefs.intents)
    .map((k) => intentDisplayLabel(k))
    .filter(Boolean);
  if (intents.length) {
    parts.push(intents.slice(0, 2).join(', ') + (intents.length > 2 ? '…' : ''));
  }
  const court = partnerCourtSideLabel(prefs.partnerCourtSide);
  if (court) parts.push(court);
  const days = formatSeekingDaysLine(prefs);
  if (days) parts.push(days);
  parts.push(seekingAvailabilitySummary(prefs));
  return parts.join(' · ');
}

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 * @returns {{
 *   filterSummary: string,
 *   summary: string,
 *   status: 'unconfigured' | 'inactive' | 'active' | 'expired',
 *   ttlRemainingMs: number | null,
 * }}
 */
export function describeActiveSeeking(user, channel) {
  const prefs = normalizeChannelPrefs(user, channel);
  const configured = channel === 'kamp'
    ? isMatchFilterConfigured(prefs, user)
    : isMakkerFilterConfigured(prefs, user);

  if (!configured) {
    return {
      filterSummary: 'Vælg region',
      summary: 'Vælg region',
      status: 'unconfigured',
      ttlRemainingMs: null,
    };
  }

  const filterSummary = buildActiveSeekingFilterSummary(user, channel);
  let status = 'inactive';
  let ttlRemainingMs = null;

  if (isSeekingUiActive(user, channel)) {
    status = 'active';
    ttlRemainingMs = seekingTtlRemainingMs(user, channel);
  } else if (isSeekingTtlExpired(user, channel)) {
    status = 'expired';
  }

  return {
    filterSummary,
    summary: filterSummary,
    status,
    ttlRemainingMs,
  };
}

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 * @param {string} [regionOverride]
 */
export function buildEnableSeekingPrefs(user, channel, regionOverride) {
  const prefs = normalizeChannelPrefs(user, channel);
  const fallbackRegion =
    canonicalRegionForForm(regionOverride)
    || canonicalRegionForForm(user?.area)
    || user?.area
    || '';
  const resolved = channel === 'kamp'
    ? resolveFilterRegion(prefs, user)
    : resolveMakkerFilterRegion(prefs, user);

  const renewing = !isChannelFeedLive(user, channel);
  return {
    ...prefs,
    feedVisible: true,
    notify: true,
    region: resolved || fallbackRegion || prefs.region || '',
    ...(renewing ? { feedVisibleSince: new Date().toISOString() } : {}),
  };
}

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function buildDisableSeekingPrefs(user, channel) {
  const prefs = normalizeChannelPrefs(user, channel);
  return {
    ...prefs,
    feedVisible: false,
    notify: false,
  };
}

/**
 * @param {object} user
 * @param {SeekingChannel} channel
 * @param {boolean} enabled
 * @param {string} [regionOverride]
 */
export function buildSeekingProfilePatch(user, channel, enabled, regionOverride) {
  const prefs = enabled
    ? buildEnableSeekingPrefs(user, channel, regionOverride)
    : buildDisableSeekingPrefs(user, channel);
  return channel === 'kamp'
    ? buildProfilePatchFromMatchSearchPrefs(prefs, user)
    : buildProfilePatchFromMakkerSearchPrefs(prefs, user);
}

/**
 * @param {SeekingChannel} channel
 */
export function seekingChannelLabel(channel) {
  return channel === 'kamp' ? 'Søger kamp' : 'Søger makker';
}

/**
 * @param {SeekingChannel} channel
 */
export function seekingFilterPath(channel) {
  return channel === 'kamp' ? '/dashboard/kamp-filter' : '/dashboard/makker-filter';
}

/**
 * Slår kanaler fra i DB når TTL er udløbet men prefs stadig siger ON.
 * @param {object} user
 * @returns {object | null} profil-patch eller null
 */
export function buildExpiredSeekingSyncPatch(user) {
  if (!user) return null;
  /** @type {object | null} */
  let patch = null;
  let merged = user;

  for (const ch of /** @type {const} */ (['makker', 'kamp'])) {
    if (!isSeekingTtlExpired(merged, ch)) continue;
    const chPatch = buildSeekingProfilePatch(merged, ch, false);
    merged = {
      ...merged,
      ...chPatch,
      makker_search_prefs: chPatch.makker_search_prefs ?? merged.makker_search_prefs,
      match_search_prefs: chPatch.match_search_prefs ?? merged.match_search_prefs,
    };
    patch = { ...patch, ...chPatch };
  }

  return patch;
}

/**
 * @param {object} user
 */
export function seekingHomeStatusLabel(user) {
  const makker = isSeekingUiActive(user, 'makker');
  const kamp = isSeekingUiActive(user, 'kamp');
  if (makker && kamp) return 'Makker og kamp aktive';
  if (makker) return 'Søger makker';
  if (kamp) return 'Søger kamp';
  if (isSeekingTtlExpired(user, 'makker') || isSeekingTtlExpired(user, 'kamp')) {
    return 'Udløbet — slå til for at forny';
  }
  return 'Inaktiv';
}

export { seekingVisibleDurationLabel };
