import { supabase } from './supabase';
import { normalizeProfileRow } from './profileUtils';
import { fetchRowsInChunks } from './supabaseChunkFetch';

/** Kolonner til Find makker — undgår select('*') på hele profiles. */
export const PROFILE_MAKKERE_SELECT =
  'id, full_name, name, avatar, area, city, level, elo_rating, games_played, games_won, play_style, court_side, intent_now, seeking_match, seeking_match_at, match_watch_enabled, match_search_prefs, makker_search_prefs, available_days, birth_year, birth_month, birth_day, bio, is_banned, last_active_at';

/** Kolonner til kampe-kort og profil-modal fra Kampe. */
export const PROFILE_KAMPE_SELECT =
  'id, full_name, name, avatar, area, city, level, elo_rating, games_played, games_won, play_style, court_side, intent_now, seeking_match, match_watch_enabled, birth_year, birth_month, birth_day, bio, is_banned, last_active_at';

/**
 * Alle aktive spillere til Find makker (ikke banned).
 * @returns {Promise<object[]>}
 */
export async function fetchMakkerePlayerProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_MAKKERE_SELECT)
    .eq('is_banned', false);
  if (error) throw error;
  return (data || []).map((row) => normalizeProfileRow(row));
}

/**
 * Profiler for specifikke bruger-id'er (chunked).
 * @param {string[]} userIds
 * @param {string} [select]
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchProfilesByIdMap(userIds, select = PROFILE_KAMPE_SELECT) {
  const ids = [...new Set((userIds || []).map((x) => String(x)).filter(Boolean))];
  const out = {};
  if (ids.length === 0) return out;

  const rows = await fetchRowsInChunks(supabase, 'profiles', 'id', ids, select);
  for (const row of rows) {
    const norm = normalizeProfileRow(row);
    if (norm?.id != null) out[String(norm.id)] = norm;
  }
  return out;
}
