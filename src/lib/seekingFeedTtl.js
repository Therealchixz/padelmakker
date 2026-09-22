/**
 * Synlighed i feed. Kamp udloeber efter 24 timer; makker udloeber ikke.
 */

import {
  SEEK_KAMP_TTL_MS,
  SEEK_MAKKER_TTL_MS,
  seekingVisibilityPhraseOther,
  DAYS_OF_WEEK,
  intentDisplayLabel,
  PARTNER_LEVEL_LABELS,
} from './platformConstants.js';
import { normalizeStringArrayField } from './profileUtils.js';
import {
  normalizeMatchSearchPrefs,
  isMatchFilterConfigured,
  resolveFilterRegion,
  resolveFilterLevel,
} from './matchSearchFilterCore.js';
import {
  normalizeMakkerSearchPrefs,
  isMakkerFilterConfigured,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
} from './makkerSearchFilterCore.js';
import { DEFAULT_LEVEL_WINDOW } from './matchSearchFilterCore.js';
import { formatPlaytomicLevel, levelRangeForWindow } from './padelLevelUtils.js';
import {
  levelRangeForMakkerPartnerPref,
  partnerCourtSideLabel,
  availabilityMeansAllTimeSlots,
  normalizeMakkerPartnerLevel,
} from './makkerFilterMatch.js';

export { SEEK_KAMP_TTL_MS, SEEK_MAKKER_TTL_MS };

/**
 * Hvor langt tilbage feed-query'en skal hente. Makker udloeber ikke laengere,
 * saa graensen kan ikke vaere makker-TTL'en - saa ville de brugere, der
 * markerede sig for laengst, aldrig komme med i svaret fra databasen.
 * Et aar er rigeligt til at daekke alle reelle markeringer og holder stadig
 * query'en fra at scanne hele tabellen.
 */
export const SEEK_FEED_QUERY_TTL_MS = 365 * 24 * 60 * 60 * 1000;

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

export function isChannelFeedWithinTtl(sinceMs, ttlMs, nowMs = Date.now()) {
  if (sinceMs == null) return false;
  return nowMs - sinceMs < ttlMs;
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
  // Makker-markeringen udloeber IKKE. Den staar, til brugeren slaar den fra.
  // 14 brugere havde sat fluebenet; kun 1 var inden for de gamle 7 dage - de
  // oevrige var forsvundet uden at vide det. Tidspunktet bruges stadig til at
  // vise "soeger siden ..." og til rangeringen, men afgoer ikke synlighed.
  // KAMP-kanalen udloeber fortsat efter 24 timer, og det er rigtigt: en konkret
  // kamp i morgen er ikke aktuel i naeste uge.
  return channelFeedSince(normalized, profile.seeking_match_at) != null;
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

function compactRegionLine(region, city) {
  const regionPart = region ? String(region).replace(/^Region /, '').trim() : '';
  const cityPart = city != null ? String(city).trim() : '';
  if (cityPart && regionPart) return `${cityPart} · ${regionPart}`;
  return cityPart || regionPart || null;
}

function formatLevelRange(min, max) {
  return `${formatPlaytomicLevel(min)}–${formatPlaytomicLevel(max)}`;
}

function compactLevelLine(prefs, profile, levelResolver, rangeFn) {
  const lvl = levelResolver(prefs, profile);
  const win = Number(prefs.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const { min, max } = rangeFn(lvl, win, prefs, profile);
  return formatLevelRange(min, max);
}

/** Niveau-interval som andre ser ved søger makker (kun tal, ikke «Samme niveau» osv.). */
export function compactMakkerSeekingLevelDetail(prefs, profile = {}) {
  const normalized = normalizeMakkerSearchPrefs(prefs, profile);
  const pref = normalizeMakkerPartnerLevel(normalized.partnerLevel, profile) || 'same';
  if (pref === 'wide') {
    return 'Alle niveauer';
  }
  const lvl = resolveMakkerFilterLevel(normalized, profile);
  const win = Number(normalized.levelWindow) || DEFAULT_LEVEL_WINDOW;
  const { min, max } = levelRangeForMakkerPartnerPref(
    lvl,
    win,
    normalized.partnerLevel,
    profile,
  );
  return formatLevelRange(min, max);
}

function pushSeekingDetail(lines, label, value) {
  const v = value == null ? '' : String(value).trim();
  if (!v) return;
  lines.push(`${label}: ${v}`);
}

function formatSeekingDayKeys(dayKeys) {
  const keys = normalizeStringArrayField(dayKeys);
  if (!keys.length) return null;
  return keys
    .map((k) => DAYS_OF_WEEK.find((d) => d.key === k)?.label || k)
    .join(', ');
}

function makkerIntentLabel(key) {
  return intentDisplayLabel(key);
}

function makkerIntentSummary(intents) {
  const labels = normalizeStringArrayField(intents)
    .map((k) => makkerIntentLabel(k))
    .filter(Boolean);
  return labels.length ? labels.join(', ') : null;
}

/** Læsbar tekst for hvilken slags makker-niveau spilleren søger (ikke filter-UI «Fra min profil»). */
export function makkerPartnerLevelDisplayLabel(partnerLevelPref, profile = {}) {
  const effective = normalizeMakkerPartnerLevel(partnerLevelPref, profile) || 'same';
  return PARTNER_LEVEL_LABELS[effective] || 'Samme niveau';
}

/** Tidsrum fra kamp- eller makker-filter (availability-felt). */
export function seekingAvailabilitySummary(prefs) {
  const raw = normalizeStringArrayField(prefs?.availability);
  if (!raw.length || availabilityMeansAllTimeSlots(prefs?.availability)) {
    return 'Alle tidsrum';
  }
  return raw.join(', ');
}

/** Strukturerede detaljer til profil-modal (søger kamp). */
export function compactMatchSeekingDetails(prefs, profile = {}) {
  const normalized = normalizeMatchSearchPrefs(prefs, profile);
  const lines = [];
  const region = compactRegionLine(resolveFilterRegion(normalized, profile), profile.city);
  pushSeekingDetail(lines, 'Område', region);
  pushSeekingDetail(lines, 'Niveau', compactLevelLine(
    normalized,
    profile,
    resolveFilterLevel,
    (lvl, win) => levelRangeForWindow(lvl, win),
  ));
  const days = formatSeekingDayKeys(normalized.days);
  if (days) pushSeekingDetail(lines, 'Spilledage', days);
  pushSeekingDetail(lines, 'Tidsrum', seekingAvailabilitySummary(normalized));
  return lines;
}

/** Strukturerede detaljer til profil-modal (søger makker). */
export function compactMakkerSeekingDetails(prefs, profile = {}) {
  const normalized = normalizeMakkerSearchPrefs(prefs, profile);
  const lines = [];
  const region = compactRegionLine(resolveMakkerFilterRegion(normalized, profile), profile.city);
  pushSeekingDetail(lines, 'Område', region);
  pushSeekingDetail(lines, 'Niveau', compactMakkerSeekingLevelDetail(normalized, profile));

  pushSeekingDetail(lines, 'Banehalvdel', partnerCourtSideLabel(normalized.partnerCourtSide));

  if (normalized.playStyle && normalized.playStyle !== 'all') {
    pushSeekingDetail(lines, 'Spillestil', normalized.playStyle);
  }

  const intents = makkerIntentSummary(normalized.intents);
  if (intents) pushSeekingDetail(lines, 'Intention', intents);

  const days = formatSeekingDayKeys(normalized.days);
  if (days) pushSeekingDetail(lines, 'Spilledage', days);

  pushSeekingDetail(lines, 'Tidsrum', seekingAvailabilitySummary(normalized));

  return lines;
}

/** Én linje (feed m.m.) — fuld tekst joined. */
export function compactMatchSeekingLine(prefs, profile = {}) {
  return compactMatchSeekingDetails(prefs, profile).join(' · ');
}

export function compactMakkerSeekingLine(prefs, profile = {}) {
  return compactMakkerSeekingDetails(prefs, profile).join(' · ');
}

/**
 * Hvor laenge en ANDEN spillers markering staar - vises paa deres profil.
 * Kamp udloeber efter 24 timer; makker staar, til de selv slaar den fra.
 */
export function seekingChannelDurationLabel(channel) {
  return seekingVisibilityPhraseOther(channel);
}

/** ISO-tidspunkt for hvornår kanalen blev synlig (til sortering i feed). */
export function channelFeedCreatedAtIso(prefs, profile = {}) {
  const sinceMs = channelFeedSince(prefs, profile.seeking_match_at);
  if (sinceMs == null) return null;
  return new Date(sinceMs).toISOString();
}

/**
 * Én aktivitetsrække pr. aktiv kanal (kamp / makker), så begge vises i seneste aktivitet.
 * @param {Array<object>} profiles
 * @param {{ excludeUserId?: string }} [opts]
 */
export function expandProfilesToSeekingFeedRows(profiles, opts = {}) {
  const { excludeUserId } = opts;
  const rows = [];

  for (const p of profiles || []) {
    if (!p?.id) continue;
    if (excludeUserId && String(p.id) === String(excludeUserId)) continue;
    if (!isSeekingActiveProfile(p)) continue;

    const base = {
      userId: p.id,
      name: p.full_name || p.name || 'En spiller',
      avatar: p.avatar || '🎾',
      level: p.level,
      area: p.area,
      intent: p.intent_now,
      seeking_match_at: p.seeking_match_at,
      match_search_prefs: p.match_search_prefs,
      makker_search_prefs: p.makker_search_prefs,
    };

    if (isProfileMatchFeedVisible(p)) {
      const prefs = normalizeMatchSearchPrefs(p.match_search_prefs, p);
      rows.push({
        type: 'seeking_player',
        seekingChannel: 'kamp',
        ...base,
        created_at: channelFeedCreatedAtIso(prefs, p) || p.seeking_match_at,
      });
    }

    if (isProfileMakkerFeedVisible(p)) {
      const prefs = normalizeMakkerSearchPrefs(p.makker_search_prefs, p);
      rows.push({
        type: 'seeking_player',
        seekingChannel: 'makker',
        ...base,
        created_at: channelFeedCreatedAtIso(prefs, p) || p.seeking_match_at,
      });
    }
  }

  return rows.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );
}
