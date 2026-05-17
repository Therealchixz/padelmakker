import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeLandingPublicStats } from './landingStatsDisplay';

export { formatLandingStatCount, normalizeLandingPublicStats } from './landingStatsDisplay';

/**
 * Hent offentlige tal til forsiden. Returnerer null ved fejl eller manglende RPC.
 * @returns {Promise<LandingPublicStats | null>}
 */
export async function fetchLandingPublicStats() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('public_platform_stats');
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (
        msg.includes('could not find the function')
        || msg.includes('does not exist')
        || msg.includes('schema cache')
      ) {
        return null;
      }
      console.warn('public_platform_stats:', error.message || error);
      return null;
    }
    return normalizeLandingPublicStats(data);
  } catch (e) {
    console.warn('public_platform_stats:', e);
    return null;
  }
}
