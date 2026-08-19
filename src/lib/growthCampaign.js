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
 * }} GrowthCampaignStatus */

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

