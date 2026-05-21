/**
 * Mit makker-filter — Supabase-persistens og tæller.
 */

import { supabase } from './supabase';
import { notifyMakkerWatchersForProfile } from './makkerWatchUtils';
import { isSeekingActiveProfile } from './makkerSearchFilterCore';
import {
  normalizeMakkerSearchPrefs,
  isMakkerFilterConfigured,
  seekingProfileMatchesFilter,
  buildProfilePatchFromMakkerSearchPrefs,
  MAKKER_FILTER_PREFS_VERSION,
  DEFAULT_LEVEL_WINDOW,
  LEVEL_WINDOW_OPTIONS,
  LEVEL_WINDOW_CHOICES,
  defaultMakkerSearchPrefs,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
  isMakkerFilterActive,
  describeMakkerFilter,
} from './makkerSearchFilterCore';

export {
  MAKKER_FILTER_PREFS_VERSION,
  DEFAULT_LEVEL_WINDOW,
  LEVEL_WINDOW_OPTIONS,
  LEVEL_WINDOW_CHOICES,
  defaultMakkerSearchPrefs,
  normalizeMakkerSearchPrefs,
  resolveMakkerFilterRegion,
  resolveMakkerFilterLevel,
  isMakkerFilterConfigured,
  isMakkerFilterActive,
  describeMakkerFilter,
  seekingProfileMatchesFilter,
  buildProfilePatchFromMakkerSearchPrefs,
  notifyMakkerWatchersForProfile,
};

export async function saveMakkerSearchPrefs(prefs, profile = {}) {
  const patch = buildProfilePatchFromMakkerSearchPrefs(prefs, profile);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Ikke logget ind');

  const wasSeeking = isSeekingActiveProfile(profile) || profile?.seeking_match === true;
  const willSeeking = patch.seeking_match === true;

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);

  if (error) throw error;

  if (willSeeking && !wasSeeking) {
    void notifyMakkerWatchersForProfile(user.id);
  }

  return patch;
}

export async function countSeekersMatchingMakkerFilter(profile, prefs, userId) {
  if (!isMakkerFilterConfigured(prefs, profile)) return 0;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, area, level, seeking_match, seeking_match_at, available_days')
    .eq('seeking_match', true)
    .eq('is_banned', false)
    .limit(200);

  if (error) {
    console.warn('makker filter count:', error.message);
    return 0;
  }

  return (data || []).filter((row) => {
    const p = { ...row, available_days: row.available_days };
    return seekingProfileMatchesFilter(p, prefs, profile, userId);
  }).length;
}
