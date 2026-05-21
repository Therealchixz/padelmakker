import { normalizeMatchSearchPrefs, isMatchFilterConfigured } from './matchSearchFilterCore.js';
import { normalizeMakkerSearchPrefs, isMakkerFilterConfigured } from './makkerSearchFilterCore.js';

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
