import { supabase, isSupabaseConfigured } from './supabase';

export { formatCampaignSpotsLabel, growthCampaignEntriesToCsv } from './growthCampaignUtils';

export const FIRST_200_SLUG = 'first_200';

/** @typedef {{
 *   found?: boolean;
 *   slug?: string;
 *   title?: string;
 *   prize_description?: string;
 *   spots_taken?: number;
 *   spots_total?: number;
 *   is_open?: boolean;
 *   status?: string;
 *   rules_version?: string;
 *   authenticated?: boolean;
 *   qualified?: boolean;
 *   enrolled?: boolean;
 *   entry_number?: number | null;
 *   campaign_full?: boolean;
 *   draw_completed?: boolean;
 *   is_winner?: boolean;
 * }} GrowthCampaignStatus */

/** @typedef {{
 *   found?: boolean;
 *   slug?: string;
 *   title?: string;
 *   spots_taken?: number;
 *   spots_total?: number;
 *   status?: string;
 *   can_draw?: boolean;
 *   is_full?: boolean;
 *   draw_completed?: boolean;
 *   draw_at?: string | null;
 *   winner_user_id?: string | null;
 *   winner_entry_number?: number | null;
 *   winner_name?: string | null;
 *   drawn_by_name?: string | null;
 * }} GrowthCampaignDrawStatus */

function isMissingRpcError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('could not find the function')
    || msg.includes('does not exist')
    || msg.includes('schema cache')
  );
}

/**
 * @param {unknown} data
 * @returns {GrowthCampaignStatus | null}
 */
function normalizePublic(data) {
  if (!data || typeof data !== 'object' || data.found === false) return null;
  return /** @type {GrowthCampaignStatus} */ (data);
}

/**
 * @param {unknown} data
 * @returns {GrowthCampaignStatus | null}
 */
function normalizeMyStatus(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.authenticated === false) return null;
  if (data.found === false) return null;
  return /** @type {GrowthCampaignStatus} */ (data);
}

/** @returns {Promise<GrowthCampaignStatus | null>} */
export async function fetchGrowthCampaignPublic(slug = FIRST_200_SLUG) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('get_growth_campaign_public', { p_slug: slug });
    if (error) {
      if (!isMissingRpcError(error)) console.warn('get_growth_campaign_public:', error.message || error);
      return null;
    }
    return normalizePublic(data);
  } catch (e) {
    console.warn('get_growth_campaign_public:', e);
    return null;
  }
}

/** @returns {Promise<GrowthCampaignStatus | null>} */
export async function fetchMyGrowthCampaignStatus(slug = FIRST_200_SLUG) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('get_my_growth_campaign_status', { p_slug: slug });
    if (error) {
      if (!isMissingRpcError(error)) console.warn('get_my_growth_campaign_status:', error.message || error);
      return null;
    }
    return normalizeMyStatus(data);
  } catch (e) {
    console.warn('get_my_growth_campaign_status:', e);
    return null;
  }
}

/**
 * Auto-tilmeld kvalificerede brugere (eksisterende backfilles i DB; nye via denne RPC).
 * @returns {Promise<GrowthCampaignStatus | null>}
 */
export async function tryAutoEnrollGrowthCampaign(slug = FIRST_200_SLUG) {
  if (!isSupabaseConfigured) return null;
  try {
    const status = await fetchMyGrowthCampaignStatus(slug);
    if (!status) return null;
    if (status.enrolled || !status.qualified || !status.is_open) return status;

    const { data, error } = await supabase.rpc('enroll_growth_campaign', {
      p_slug: slug,
      p_consent: true,
    });
    if (error) {
      if (!isMissingRpcError(error)) console.warn('enroll_growth_campaign:', error.message || error);
      return status;
    }
    if (data?.ok) {
      return fetchMyGrowthCampaignStatus(slug);
    }
    return status;
  } catch (e) {
    console.warn('tryAutoEnrollGrowthCampaign:', e);
    return null;
  }
}

/** @returns {Promise<GrowthCampaignDrawStatus | null>} */
export async function fetchAdminGrowthCampaignDrawStatus(slug = FIRST_200_SLUG) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('admin_get_growth_campaign_draw_status', { p_slug: slug });
    if (error) {
      if (!isMissingRpcError(error)) console.warn('admin_get_growth_campaign_draw_status:', error.message || error);
      return null;
    }
    if (!data || typeof data !== 'object' || data.found === false) return null;
    return /** @type {GrowthCampaignDrawStatus} */ (data);
  } catch (e) {
    console.warn('admin_get_growth_campaign_draw_status:', e);
    return null;
  }
}

/**
 * @param {{ slug?: string; allowPartial?: boolean }} [options]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function adminDrawGrowthCampaign(options = {}) {
  const slug = options.slug ?? FIRST_200_SLUG;
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('admin_draw_growth_campaign', {
    p_slug: slug,
    p_allow_partial: Boolean(options.allowPartial),
  });
  if (error) throw error;
  return data && typeof data === 'object' ? data : null;
}

