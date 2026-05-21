/**
 * Mit kamp-filter — ren logik (ingen Supabase-import).
 */

import { canonicalRegionForForm, normalizeStringArrayField } from './profileUtils';
import { levelLabel } from './platformConstants';
import {
  profilePlaytomicLevel,
  migrateEloWindowToLevelWindow,
  matchPassesLevelFilter,
  formatPlaytomicLevel,
  levelRangeForWindow,
} from './padelLevelUtils';

export const MATCH_FILTER_PREFS_VERSION = 2;
/** Standard: snævert interval — fair kampe uden stor niveauforskel. */
export const DEFAULT_LEVEL_WINDOW = 0.3;

/** Tolerance i niveau (±), ikke længere store 0,5-spring som minimum. */
export const LEVEL_WINDOW_CHOICES = [
  { value: 0.2, label: 'Meget snævert', hint: 'Næsten samme niveau' },
  { value: 0.3, label: 'Snævert', hint: 'Anbefalet' },
  { value: 0.5, label: 'Normalt', hint: 'Lidt bredere' },
  { value: 0.7, label: 'Bredt', hint: 'Fleksibel' },
  { value: 1.0, label: 'Meget bredt', hint: 'Alle omkring dig' },
];

export const LEVEL_WINDOW_OPTIONS = LEVEL_WINDOW_CHOICES.map((c) => c.value);

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultMatchSearchPrefs(profile = {}) {
  const region = canonicalRegionForForm(profile.area) || profile.area || '';
  const days = normalizeStringArrayField(profile.available_days);
  return {
    version: MATCH_FILTER_PREFS_VERSION,
    notify: false,
    feedVisible: false,
    region: region || '',
    myLevel: profilePlaytomicLevel(profile),
    levelWindow: DEFAULT_LEVEL_WINDOW,
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

  let levelWindow = Number(parsed.levelWindow);
  if (!Number.isFinite(levelWindow) && parsed.eloWindow != null) {
    levelWindow = migrateEloWindowToLevelWindow(parsed.eloWindow);
  }
  if (!Number.isFinite(levelWindow) || levelWindow < 0.15 || levelWindow > 1.5) {
    levelWindow = levelWindow > 1.5 ? 1 : base.levelWindow;
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
    || (parsed.notify == null && profile.match_watch_enabled === true && Object.keys(parsed).length === 0);
  const feedVisible = parsed.feedVisible === true
    || (parsed.feedVisible == null && profile.seeking_match === true && Object.keys(parsed).length === 0);

  return {
    version: MATCH_FILTER_PREFS_VERSION,
    notify,
    feedVisible,
    region: region || '',
    myLevel,
    levelWindow,
    days,
    openOnly: parsed.openOnly !== false,
  };
}

export function resolveFilterRegion(prefs, profile = {}) {
  const fromPrefs = canonicalRegionForForm(prefs?.region) || (prefs?.region ? String(prefs.region).trim() : '');
  if (fromPrefs) return fromPrefs;
  return canonicalRegionForForm(profile.area) || profile.area || '';
}

export function resolveFilterLevel(prefs, profile = {}) {
  const n = Number(prefs?.myLevel);
  if (Number.isFinite(n) && n >= 1 && n <= 7) return Math.round(n * 10) / 10;
  return profilePlaytomicLevel(profile);
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
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[d.getDay()] || null;
}

export function openMatchMatchesFilter(match, creatorProfile, prefs, profile, myUserId) {
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

  const myLevel = resolveFilterLevel(prefs, profile);
  const levelWindow = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  if (!matchPassesLevelFilter(myLevel, levelWindow, creatorProfile, match)) {
    return false;
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
  const lvl = resolveFilterLevel(prefs, profile);
  const win = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const { min, max } = levelRangeForWindow(lvl, win);
  const short = levelLabel(lvl) || formatPlaytomicLevel(lvl);
  parts.push(`${short} (${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)})`);
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
      version: MATCH_FILTER_PREFS_VERSION,
      region: region || normalized.region,
      myLevel: resolveFilterLevel(normalized, profile),
    },
    match_watch_enabled: notifyOn,
    match_watch_at: notifyOn ? new Date().toISOString() : null,
    seeking_match: feedOn,
    seeking_match_at: feedOn ? new Date().toISOString() : null,
    ...(region && region !== profile.area ? { area: region } : {}),
  };
}
