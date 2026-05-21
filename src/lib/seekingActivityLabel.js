import { normalizeMatchSearchPrefs, isMatchFilterConfigured, describeMatchFilter } from './matchSearchFilterCore.js';
import {
  normalizeMakkerSearchPrefs,
  isMakkerFilterConfigured,
  describeMakkerFilter,
  isSeekingActiveProfile,
} from './makkerSearchFilterCore.js';
import { seekingVisibleDurationLabel, INTENT_LABELS } from './platformConstants.js';

export function isProfileMatchFeedVisible(profile) {
  const prefs = normalizeMatchSearchPrefs(profile?.match_search_prefs, profile);
  return isMatchFilterConfigured(prefs, profile) && prefs.feedVisible === true;
}

export function isProfileMakkerFeedVisible(profile) {
  const prefs = normalizeMakkerSearchPrefs(profile?.makker_search_prefs, profile);
  return isMakkerFilterConfigured(prefs, profile) && prefs.feedVisible === true;
}

/** Tekst til aktivitetsfeed, makkerliste m.m. */
export function seekingActivityLabel(profile) {
  const matchOn = isProfileMatchFeedVisible(profile);
  const makkerOn = isProfileMakkerFeedVisible(profile);
  if (matchOn && makkerOn) return 'søger kamp og makker';
  if (makkerOn) return 'søger makker';
  if (matchOn) return 'søger kamp';
  return 'søger kamp';
}

/** Badge/label med stort begyndelsesbogstav (fx «Søger makker»). */
export function seekingActivityLabelDisplay(profile) {
  const text = seekingActivityLabel(profile);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatSeekingSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'lige nu';
  if (min < 60) return `${min} min siden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  return `${d} d siden`;
}

/**
 * Detaljer til profil-modal når spilleren aktivt søger kamp/makker.
 * @returns {null | { headline: string, blocks: Array<{ type: string, label: string, summary: string, detail: string }>, intentLabel: string | null, sinceLabel: string | null, visibleFor: string }}
 */
export function getPlayerSeekingDetails(profile) {
  if (!profile || !isSeekingActiveProfile(profile)) return null;

  const headline = seekingActivityLabelDisplay(profile);
  const blocks = [];

  if (isProfileMatchFeedVisible(profile)) {
    const prefs = normalizeMatchSearchPrefs(profile.match_search_prefs, profile);
    const info = describeMatchFilter(prefs, profile);
    if (info.configured) {
      blocks.push({
        type: 'kamp',
        label: 'Søger kamp',
        summary: info.summary,
        detail: info.detail,
      });
    }
  }

  if (isProfileMakkerFeedVisible(profile)) {
    const prefs = normalizeMakkerSearchPrefs(profile.makker_search_prefs, profile);
    const info = describeMakkerFilter(prefs, profile);
    if (info.configured) {
      blocks.push({
        type: 'makker',
        label: 'Søger makker',
        summary: info.summary,
        detail: info.detail,
      });
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      type: 'generic',
      label: headline,
      summary: profile.area || profile.city || '—',
      detail: `Synlig i feed i ${seekingVisibleDurationLabel()}`,
    });
  }

  const intentKey = profile.intent_now;
  const intentLabel = intentKey && INTENT_LABELS[intentKey] ? INTENT_LABELS[intentKey] : null;
  const sinceLabel = formatSeekingSince(profile.seeking_match_at);

  return {
    headline,
    blocks,
    intentLabel,
    sinceLabel,
    visibleFor: seekingVisibleDurationLabel(),
  };
}
