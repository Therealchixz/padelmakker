/**
 * Mit kamp-filter — ren logik (ingen Supabase-import).
 */

import { canonicalRegionForForm, normalizeStringArrayField } from './profileUtils';
import { parseMatchLevelRange } from './matchLevelRange';
import { resolveElo } from './matchmakingUtils';

export const MATCH_FILTER_PREFS_VERSION = 1;
export const DEFAULT_ELO_WINDOW = 250;
export const ELO_WINDOW_OPTIONS = [150, 200, 250, 300, 400];

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultMatchSearchPrefs(profile = {}) {
  const region = canonicalRegionForForm(profile.area) || profile.area || '';
  const days = normalizeStringArrayField(profile.available_days);
  return {
    version: MATCH_FILTER_PREFS_VERSION,
    notify: false,
    feedVisible: false,
    region: region || '',
    eloWindow: DEFAULT_ELO_WINDOW,
    days,
    openOnly: true,
  };
}

export function normalizeMatchSearchPrefs(raw, profile = {}) {
  const base = defaultMatchSearchPrefs(profile);
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
  const eloWindow = Number(parsed.eloWindow);
  const notify = parsed.notify === true
    || (parsed.notify == null && profile.match_watch_enabled === true && Object.keys(parsed).length === 0);
  const feedVisible = parsed.feedVisible === true
    || (parsed.feedVisible == null && profile.seeking_match === true && Object.keys(parsed).length === 0);

  return {
    version: MATCH_FILTER_PREFS_VERSION,
    notify,
    feedVisible,
    region: region || '',
    eloWindow: Number.isFinite(eloWindow) && eloWindow >= 50 && eloWindow <= 500
      ? Math.round(eloWindow)
      : base.eloWindow,
    days,
    openOnly: parsed.openOnly !== false,
  };
}

export function resolveFilterRegion(prefs, profile = {}) {
  const fromPrefs = canonicalRegionForForm(prefs?.region) || (prefs?.region ? String(prefs.region).trim() : '');
  if (fromPrefs) return fromPrefs;
  return canonicalRegionForForm(profile.area) || profile.area || '';
}

export function isMatchFilterConfigured(prefs, profile = {}) {
  return Boolean(resolveFilterRegion(prefs, profile));
}

export function isMatchFilterActive(prefs, profile = {}) {
  if (!isMatchFilterConfigured(prefs, profile)) return false;
  return Boolean(prefs.notify || prefs.feedVisible);
}

export function dayKeyFromDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.getDay();
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[iso] || null;
}

export function openMatchMatchesFilter(match, creatorProfile, myElo, prefs, profile, myUserId) {
  if (!match || !isMatchFilterConfigured(prefs, profile)) return false;
  if (myUserId && String(match.creator_id) === String(myUserId)) return false;
  if (prefs.openOnly !== false) {
    if (match.status !== 'open') return false;
    if (match.match_type === 'closed') return false;
    const maxP = Number(match.max_players) || 4;
    const cur = Number(match.current_players) || 0;
    if (cur >= maxP) return false;
  }

  const filterRegion = resolveFilterRegion(prefs, profile);
  const creatorRegion = canonicalRegionForForm(creatorProfile?.area) || creatorProfile?.area || '';
  if (filterRegion && creatorRegion && filterRegion.toLowerCase() !== creatorRegion.toLowerCase()) {
    return false;
  }

  const window = Number(prefs.eloWindow) || DEFAULT_ELO_WINDOW;
  const creatorElo = resolveElo(creatorProfile || {}, {});
  if (Math.abs(myElo - creatorElo) > window) return false;

  const range = parseMatchLevelRange(match.level_range);
  if (range.min != null && range.max != null) {
    if (myElo < range.min || myElo > range.max) return false;
  }

  const days = normalizeStringArrayField(prefs.days);
  if (days.length > 0 && match.date) {
    const key = dayKeyFromDate(match.date);
    if (key && !days.includes(key)) return false;
  }

  return true;
}

export function describeMatchFilter(prefs, profile = {}) {
  if (!isMatchFilterConfigured(prefs, profile)) {
    return { configured: false, summary: 'Ikke sat op', detail: 'Vælg region og gem dit filter.' };
  }
  const parts = [];
  const region = resolveFilterRegion(prefs, profile);
  if (region) parts.push(region.replace(/^Region /, ''));
  parts.push(`ELO ±${prefs.eloWindow || DEFAULT_ELO_WINDOW}`);
  const days = normalizeStringArrayField(prefs.days);
  if (days.length > 0) parts.push(`${days.length} ${days.length === 1 ? 'dag' : 'dage'}`);
  const channels = [];
  if (prefs.notify) channels.push('notifikationer');
  if (prefs.feedVisible) channels.push('feed 24t');
  const channelText = channels.length ? channels.join(' + ') : 'ingen kanal aktiv';
  return {
    configured: true,
    summary: parts.join(' · '),
    detail: channelText,
    active: isMatchFilterActive(prefs, profile),
  };
}

export function buildProfilePatchFromMatchSearchPrefs(prefs, profile = {}) {
  const normalized = normalizeMatchSearchPrefs(prefs, profile);
  const configured = isMatchFilterConfigured(normalized, profile);
  const notifyOn = configured && normalized.notify;
  const feedOn = configured && normalized.feedVisible;
  const region = resolveFilterRegion(normalized, profile);

  return {
    match_search_prefs: {
      ...normalized,
      region: region || normalized.region,
    },
    match_watch_enabled: notifyOn,
    match_watch_at: notifyOn ? new Date().toISOString() : null,
    seeking_match: feedOn,
    seeking_match_at: feedOn ? new Date().toISOString() : null,
    ...(region && region !== profile.area ? { area: region } : {}),
  };
}
