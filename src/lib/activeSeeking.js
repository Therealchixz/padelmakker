/**
 * Aktiv søgning — én switch pr. kanal (synlighed + notifikationer).
 * Bygger på eksisterende makker/match_search_prefs uden ny backend.
 */

import { canonicalRegionForForm } from './profileUtils.js';
import {
  normalizeMakkerSearchPrefs,
  buildProfilePatchFromMakkerSearchPrefs,
  resolveMakkerFilterRegion,
  describeMakkerFilter,
} from './makkerSearchFilterCore.js';
import {
  normalizeMatchSearchPrefs,
  buildProfilePatchFromMatchSearchPrefs,
  resolveFilterRegion,
  describeMatchFilter,
} from './matchSearchFilterCore.js';
import {
  isProfileMakkerFeedVisible,
  isProfileMatchFeedVisible,
  channelFeedSince,
  isChannelFeedWithinTtl,
} from './seekingFeedTtl.js';
import {
  SEEK_KAMP_TTL_MS,
  SEEK_MAKKER_TTL_MS,
  seekingVisibleDurationLabel,
} from './platformConstants.js';

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
 * @param {object} user
 * @param {SeekingChannel} channel
 */
export function describeActiveSeeking(user, channel) {
  const info = channel === 'kamp'
    ? describeMatchFilter(normalizeChannelPrefs(user, channel), user)
    : describeMakkerFilter(normalizeChannelPrefs(user, channel), user);

  if (!info.configured) {
    return { summary: 'Vælg region', detail: 'Kræves for aktiv søgning' };
  }

  const parts = [info.summary];
  if (isSeekingUiActive(user, channel)) {
    const rem = seekingTtlRemainingMs(user, channel);
    parts.push(formatSeekingTtlRemaining(rem));
    parts.push('får besked ved match');
  } else if (isSeekingTtlExpired(user, channel)) {
    parts.push('udløbet — slå til for at forny');
  }

  return {
    summary: info.summary,
    detail: parts.filter(Boolean).join(' · '),
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
