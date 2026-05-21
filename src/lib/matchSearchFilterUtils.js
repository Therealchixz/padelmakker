/**
 * Mit kamp-filter — Supabase-persistens og kamp-tæller.
 */

import { supabase } from './supabase';
import { fetchEloByUserIdFromHistory } from './eloHistoryUtils';
import { resolveElo } from './matchmakingUtils';
import { notifyMatchWatchersForMatch } from './matchWatchUtils';
import {
  normalizeMatchSearchPrefs,
  isMatchFilterConfigured,
  openMatchMatchesFilter,
  buildProfilePatchFromMatchSearchPrefs,
  MATCH_FILTER_PREFS_VERSION,
  DEFAULT_ELO_WINDOW,
  ELO_WINDOW_OPTIONS,
  defaultMatchSearchPrefs,
  resolveFilterRegion,
  isMatchFilterActive,
  describeMatchFilter,
  dayKeyFromDate,
} from './matchSearchFilterCore';

export {
  MATCH_FILTER_PREFS_VERSION,
  DEFAULT_ELO_WINDOW,
  ELO_WINDOW_OPTIONS,
  defaultMatchSearchPrefs,
  normalizeMatchSearchPrefs,
  resolveFilterRegion,
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

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id);

  if (error) throw error;
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
    .select('id, area, elo_rating, level')
    .in('id', creatorIds);

  const creatorById = Object.fromEntries((creators || []).map((p) => [String(p.id), p]));
  const eloByUserId = await fetchEloByUserIdFromHistory([userId, ...creatorIds]);
  const myElo = resolveElo(profile, eloByUserId);

  return rows.filter((m) => {
    const creator = creatorById[String(m.creator_id)] || null;
    return openMatchMatchesFilter(m, creator, myElo, prefs, profile, userId);
  }).length;
}
