import { normalizeProfileRow, canonicalRegionForForm, toPersonNameCase } from './profileUtils.js';
import { DEFAULT_REGION } from './platformConstants.js';
import { PROFILE_SAFE_SELECT } from './profileQueries.js';
import { shouldCreateProfileOnFetchStatus } from './profileBootstrapPolicy.js';

export { shouldCreateProfileOnFetchStatus } from './profileBootstrapPolicy.js';

/**
 * @typedef {'ok' | 'missing' | 'error' | 'timeout'} ProfileFetchStatus
 * @typedef {{ status: ProfileFetchStatus, profile: object | null, message?: string }} ProfileFetchResult
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} [select]
 * @returns {Promise<ProfileFetchResult>}
 */
export async function fetchProfileRowResult(supabase, userId, select = PROFILE_SAFE_SELECT) {
  if (!userId) return { status: 'missing', profile: null };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      return { status: 'error', profile: null, message: error.message || 'profiles fetch failed' };
    }
    if (!data) return { status: 'missing', profile: null };
    return { status: 'ok', profile: normalizeProfileRow(data) };
  } catch (e) {
    return {
      status: 'error',
      profile: null,
      message: e?.message || 'profiles fetch failed',
    };
  }
}

/**
 * Create profile for a brand-new auth user (confirmed missing row only).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} userRow
 * @param {string} [select]
 * @returns {Promise<object | null>}
 */
export async function createProfileForNewUser(supabase, userRow, select = PROFILE_SAFE_SELECT) {
  if (!userRow?.id) return null;
  const meta = userRow.user_metadata || {};
  const email = userRow.email || '';
  const displayName =
    toPersonNameCase(meta.full_name || meta.name) ||
    (email ? email.split('@')[0] : '') ||
    'Spiller';
  const regionFromMeta =
    canonicalRegionForForm(meta.region || meta.area || '') || DEFAULT_REGION;
  const { data: row, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userRow.id,
        email: email || '',
        name: displayName,
        full_name: displayName,
        level: meta.level || 5,
        play_style: meta.play_style || 'Ved ikke endnu',
        area: regionFromMeta,
        city: meta.city || null,
        availability: meta.availability || [],
        bio: meta.bio || '',
        avatar: meta.avatar || '🎾',
        birth_year: meta.birth_year ?? null,
        birth_month: meta.birth_month ?? null,
        birth_day: meta.birth_day ?? null,
        court_side: meta.court_side ?? null,
        intent_now: meta.intent_now || null,
        preferred_partner_level: meta.preferred_partner_level || null,
        seeking_match: meta.seeking_match === true,
        travel_willing: meta.travel_willing === true,
      },
      { onConflict: 'id' },
    )
    .select(select)
    .single();
  if (error) {
    console.warn('profiles upsert:', error.message);
    return null;
  }
  return normalizeProfileRow(row || null);
}

/**
 * Load profile for auth bootstrap: read first; create only when row is missing.
 * Never treats network/DB errors as "missing".
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} userRow
 * @param {{ timeoutMs?: number, select?: string }} [opts]
 * @returns {Promise<ProfileFetchResult>}
 */
export async function loadOrCreateProfileResult(supabase, userRow, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const select = opts.select || PROFILE_SAFE_SELECT;
  if (!userRow?.id) return { status: 'missing', profile: null };

  const timed = await Promise.race([
    fetchProfileRowResult(supabase, userRow.id, select),
    new Promise((resolve) => {
      setTimeout(() => resolve({ status: 'timeout', profile: null, message: 'timeout' }), timeoutMs);
    }),
  ]);

  if (!shouldCreateProfileOnFetchStatus(timed.status)) {
    return timed;
  }

  const created = await createProfileForNewUser(supabase, userRow, select);
  if (!created) {
    return { status: 'error', profile: null, message: 'profiles upsert failed' };
  }
  return { status: 'ok', profile: created };
}
