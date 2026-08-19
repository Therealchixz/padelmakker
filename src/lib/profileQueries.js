import { supabase } from './supabase';
import { normalizeProfileRow } from './profileUtils';
import { fetchRowsInChunks } from './supabaseChunkFetch';

/**
 * Alle profil-kolonner undtagen `email` (column privilege revoked for API).
 * Brug denne i stedet for select('*') / .select() return.
 */
export const PROFILE_SAFE_SELECT = [
  'id',
  'name',
  'full_name',
  'level',
  'play_style',
  'area',
  'city',
  'availability',
  'available_days',
  'bio',
  'avatar_emoji',
  'avatar',
  'elo_rating',
  'americano_elo_rating',
  'games_played',
  'games_won',
  'games_lost',
  'best_streak',
  'current_streak',
  'created_at',
  'birth_year',
  'birth_month',
  'birth_day',
  'court_side',
  'americano_wins',
  'americano_losses',
  'americano_draws',
  'americano_played',
  'role',
  'is_banned',
  'ban_reason',
  'latitude',
  'longitude',
  'travel_willing',
  'intent_now',
  'seeking_match',
  'seeking_match_at',
  'last_active_at',
  'preferred_partner_level',
  'phone_verification_exempt',
  'notification_prefs',
  'match_watch_enabled',
  'match_watch_at',
  'makker_search_prefs',
  'makker_watch_enabled',
  'makker_watch_at',
  'match_search_prefs',
].join(', ');

/** Kolonner til Find makker — undgår select('*') på hele profiles. */
export const PROFILE_MAKKERE_SELECT =
  'id, full_name, name, avatar, area, city, latitude, longitude, level, elo_rating, games_played, games_won, play_style, court_side, intent_now, seeking_match, seeking_match_at, match_watch_enabled, match_search_prefs, makker_search_prefs, available_days, birth_year, birth_month, birth_day, bio, is_banned, last_active_at';

/** Kolonner til kampe-kort og profil-modal fra Kampe. */
export const PROFILE_KAMPE_SELECT =
  'id, full_name, name, avatar, area, city, level, elo_rating, games_played, games_won, play_style, court_side, intent_now, seeking_match, match_watch_enabled, birth_year, birth_month, birth_day, bio, is_banned, last_active_at';

/** match_players uden user_email (column privilege revoked). */
export const MATCH_PLAYERS_SAFE_SELECT =
  'id, match_id, user_id, user_name, user_emoji, joined_at, team';

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

/**
 * Admin-only: profiler inkl. e-mail via SECURITY DEFINER RPC.
 * @param {string[]} [userIds] — hvis sat, filtrér til disse id'er
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchAdminProfilesWithEmailMap(userIds) {
  const { data, error } = await supabase.rpc('admin_profiles_with_email');
  if (error) throw error;
  const want = userIds?.length
    ? new Set(userIds.map((x) => String(x)).filter(Boolean))
    : null;
  const out = {};
  for (const row of data || []) {
    const id = row?.id != null ? String(row.id) : '';
    if (!id) continue;
    if (want && !want.has(id)) continue;
    out[id] = normalizeProfileRow(row);
  }
  return out;
}
