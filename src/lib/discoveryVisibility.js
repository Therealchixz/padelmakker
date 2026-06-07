import { canonicalRegionForForm } from './profileUtils';
import {
  normalizeMakkerSearchPrefs,
  buildProfilePatchFromMakkerSearchPrefs,
  resolveMakkerFilterRegion,
} from './makkerSearchFilterCore';
import {
  normalizeMatchSearchPrefs,
  buildProfilePatchFromMatchSearchPrefs,
  resolveFilterRegion,
} from './matchSearchFilterCore';
import {
  isProfileMakkerFeedVisible,
  isProfileMatchFeedVisible,
  isSeekingActiveProfile,
} from './seekingFeedTtl';

export { isSeekingActiveProfile };

/**
 * @param {object} user
 * @param {'makker' | 'kamp'} channel
 */
export function hasDiscoveryRegion(user, channel = 'makker') {
  if (channel === 'kamp') {
    const prefs = normalizeMatchSearchPrefs(user?.match_search_prefs, user);
    return Boolean(resolveFilterRegion(prefs, user));
  }
  const prefs = normalizeMakkerSearchPrefs(user?.makker_search_prefs, user);
  return Boolean(resolveMakkerFilterRegion(prefs, user));
}

/**
 * @param {object} user
 * @param {'makker' | 'kamp'} channel
 */
export function buildEnableVisibilityPrefs(user, channel) {
  const isKamp = channel === 'kamp';
  const prefs = isKamp
    ? normalizeMatchSearchPrefs(user?.match_search_prefs, user)
    : normalizeMakkerSearchPrefs(user?.makker_search_prefs, user);
  const resolvedRegion = isKamp
    ? resolveFilterRegion(prefs, user)
    : resolveMakkerFilterRegion(prefs, user);
  const fallbackRegion = canonicalRegionForForm(user?.area) || user?.area || '';
  return {
    ...prefs,
    feedVisible: true,
    region: resolvedRegion || fallbackRegion || prefs.region || '',
  };
}

/**
 * @param {object} user
 * @param {'makker' | 'kamp'} channel
 */
export function buildEnableVisibilityPatch(user, channel) {
  const prefs = buildEnableVisibilityPrefs(user, channel);
  return channel === 'kamp'
    ? buildProfilePatchFromMatchSearchPrefs(prefs, user)
    : buildProfilePatchFromMakkerSearchPrefs(prefs, user);
}

/**
 * @param {object} user
 * @param {'makker' | 'kamp'} channel
 */
export function isChannelVisible(user, channel) {
  return channel === 'kamp'
    ? isProfileMatchFeedVisible(user)
    : isProfileMakkerFeedVisible(user);
}
