/**
 * Synlighed i feed for kamp (24 t) og makker (7 d) — adskilt TTL.
 */

import {
  SEEK_KAMP_TTL_MS,
  SEEK_MAKKER_TTL_MS,
  seekingVisibleDurationLabel,
} from './platformConstants';
import {
  normalizeMatchSearchPrefs,
  isMatchFilterConfigured,
  resolveFilterRegion,
  resolveFilterLevel,
} from './matchSearchFilterCore';
import {
  normalizeMakkerSearchPrefs,
  isMakkerFilterConfigured,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
} from './makkerSearchFilterCore';
import { DEFAULT_LEVEL_WINDOW } from './matchSearchFilterCore';
import { formatPlaytomicLevel, levelRangeForWindow } from './padelLevelUtils';
import { levelRangeForMakkerPartnerPref } from './makkerFilterMatch';

export { SEEK_KAMP_TTL_MS, SEEK_MAKKER_TTL_MS };

/** Længste feed-TTL — bruges til DB-query og legacy SEEK_TTL_MS. */
export const SEEK_FEED_QUERY_TTL_MS = SEEK_MAKKER_TTL_MS;

function parseSinceMs(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Hvornår feedVisible blev slået til (prefs.feedVisibleSince eller seeking_match_at). */
export function channelFeedSince(prefs, profileFallbackAt) {
  const fromPrefs = parseSinceMs(prefs?.feedVisibleSince);
  if (fromPrefs != null) return fromPrefs;
  return parseSinceMs(profileFallbackAt);
}

export function isChannelFeedWithinTtl(sinceMs, ttlMs) {
  if (sinceMs == null) return false;
  return Date.now() - sinceMs < ttlMs;
}

function isMatchFeedActiveFromPrefs(prefs, profile = {}) {
  const normalized = normalizeMatchSearchPrefs(prefs, profile);
  if (!isMatchFilterConfigured(normalized, profile) || !normalized.feedVisible) return false;
  const since = channelFeedSince(normalized, profile.seeking_match_at);
  return isChannelFeedWithinTtl(since, SEEK_KAMP_TTL_MS);
}

function isMakkerFeedActiveFromPrefs(prefs, profile = {}) {
  const normalized = normalizeMakkerSearchPrefs(prefs, profile);
  if (!isMakkerFilterConfigured(normalized, profile) || !normalized.feedVisible) return false;
  const since = channelFeedSince(normalized, profile.seeking_match_at);
  return isChannelFeedWithinTtl(since, SEEK_MAKKER_TTL_MS);
}

export function isProfileMatchFeedVisible(profile) {
  if (!profile) return false;
  return isMatchFeedActiveFromPrefs(profile.match_search_prefs, profile);
}

export function isProfileMakkerFeedVisible(profile) {
  if (!profile) return false;
  return isMakkerFeedActiveFromPrefs(profile.makker_search_prefs, profile);
}

export function isSeekingActiveProfile(profile) {
  return isProfileMatchFeedVisible(profile) || isProfileMakkerFeedVisible(profile);
}

/** Synkroniserer profiles.seeking_match fra begge filters feedVisible + TTL. */
export function resolveSeekingMatchVisible(matchPrefs, makkerPrefs, profile = {}) {
  const merged = { ...profile };
  if (matchPrefs != null) merged.match_search_prefs = matchPrefs;
  if (makkerPrefs != null) merged.makker_search_prefs = makkerPrefs;
  return isProfileMatchFeedVisible(merged) || isProfileMakkerFeedVisible(merged);
}

/** Opdater feedVisibleSince når synlighed toggles. */
export function mergeFeedVisibleSince(normalized, previousPrefs, _profile = {}) {
  const prev = previousPrefs && typeof previousPrefs === 'object'
    ? previousPrefs
    : {};
  let feedVisibleSince = normalized.feedVisibleSince ?? prev.feedVisibleSince ?? null;
  if (normalized.feedVisible && !prev.feedVisible) {
    feedVisibleSince = new Date().toISOString();
  }
  if (!normalized.feedVisible) {
    feedVisibleSince = null;
  }
  return feedVisibleSince;
}

export function resolveSeekingMatchAtForProfile(matchPrefs, makkerPrefs, profile = {}) {
  const stamps = [];
  const m = normalizeMatchSearchPrefs(matchPrefs, profile);
  const k = normalizeMakkerSearchPrefs(makkerPrefs, profile);
  if (isMatchFeedActiveFromPrefs(m, profile)) {
    const ms = channelFeedSince(m, profile.seeking_match_at);
    if (ms != null) stamps.push(ms);
  }
  if (isMakkerFeedActiveFromPrefs(k, profile)) {
    const ms = channelFeedSince(k, profile.seeking_match_at);
    if (ms != null) stamps.push(ms);
  }
  if (stamps.length === 0) return null;
  return new Date(Math.max(...stamps)).toISOString();
}

function compactRegionLine(region) {
  if (!region) return null;
  return String(region).replace(/^Region /, '').trim() || null;
}

function compactLevelLine(prefs, profile, levelResolver, rangeFn) {
  const lvl = levelResolver(prefs, profile);
  const win = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const { min, max } = rangeFn(lvl, win, prefs, profile);
  return `Niveau ${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`;
}

/** Én kort linje til profil-modal — kun region + niveau. */
export function compactMatchSeekingLine(prefs, profile = {}) {
  const normalized = normalizeMatchSearchPrefs(prefs, profile);
  const parts = [];
  const region = compactRegionLine(resolveFilterRegion(normalized, profile));
  if (region) parts.push(region);
  parts.push(compactLevelLine(normalized, profile, resolveFilterLevel, (lvl, win) => levelRangeForWindow(lvl, win)));
  return parts.join(' · ');
}

export function compactMakkerSeekingLine(prefs, profile = {}) {
  const normalized = normalizeMakkerSearchPrefs(prefs, profile);
  const parts = [];
  const region = compactRegionLine(resolveMakkerFilterRegion(normalized, profile));
  if (region) parts.push(region);
  parts.push(compactLevelLine(
    normalized,
    profile,
    resolveMakkerFilterLevel,
    (lvl, win, p, prof) => levelRangeForMakkerPartnerPref(lvl, win, p.partnerLevel, prof),
  ));
  return parts.join(' · ');
}

export function seekingChannelDurationLabel(channel) {
  return seekingVisibleDurationLabel(channel);
}
