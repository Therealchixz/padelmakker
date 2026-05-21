/**
 * Mit kamp-filter — Supabase-persistens og kamp-tæller.
 */

import { supabase } from './supabase';
import { notifyMatchWatchersForMatch } from './matchWatchUtils';
import { notifyMakkerWatchersForProfile } from './makkerWatchUtils';
import { isSeekingActiveProfile } from './makkerSearchFilterCore';
import {
  normalizeMatchSearchPrefs,
  isMatchFilterConfigured,
  openMatchMatchesFilter,
  buildProfilePatchFromMatchSearchPrefs,
  MATCH_FILTER_PREFS_VERSION,
  DEFAULT_LEVEL_WINDOW,
  LEVEL_WINDOW_OPTIONS,
  LEVEL_WINDOW_CHOICES,
  defaultMatchSearchPrefs,
  resolveFilterRegion,
  resolveFilterLevel,
  isMatchFilterActive,
  describeMatchFilter,
  dayKeyFromDate,
} from './matchSearchFilterCore';

export {
  MATCH_FILTER_PREFS_VERSION,
  DEFAULT_LEVEL_WINDOW,
  LEVEL_WINDOW_OPTIONS,
  LEVEL_WINDOW_CHOICES,
  defaultMatchSearchPrefs,
  normalizeMatchSearchPrefs,
  resolveFilterRegion,
  resolveFilterLevel,
  isMatchFilterConfigured,
  isMatchFilterActive,
  describeMatchFilter,
  dayKeyFromDate,
  openMatchMatchesFilter,
  buildProfilePatchFromMatchSearchPrefs,
  notifyMatchWatchersForMatch,
};

export async function saveMatchSearchPrefs(prefs, profile = {}) {
  const patch = buildProfilePatchFromMatchSearchPrefs(prefs, profile);
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

export async function countOpenMatchesMatchingFilter(profile, prefs, userId) {
  if (!isMatchFilterConfigured(prefs, profile)) return 0;

  const today = new Date().toISOString().split('T')[0];
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, creator_id, date, court_name, status, match_type, current_players, max_players, level_range, created_at')
    .eq('status', 'open')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(80);

  if (error) {
    console.warn('match filter count:', error.message);
    return 0;
  }

  const rows = (matches || []).filter((m) => String(m.creator_id) !== String(userId));
  if (rows.length === 0) return 0;

  const creatorIds = [...new Set(rows.map((m) => m.creator_id).filter(Boolean))];
  const { data: creators } = await supabase
    .from('profiles')
    .select('id, area, level')
    .in('id', creatorIds);

  const creatorById = Object.fromEntries((creators || []).map((p) => [String(p.id), p]));

  return rows.filter((m) => {
    const creator = creatorById[String(m.creator_id)] || null;
    return openMatchMatchesFilter(m, creator, prefs, profile, userId);
  }).length;
}
