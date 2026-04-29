import { supabase } from './supabase.js';
import { formatEloSuccessToast } from './eloToastMessages.js';

/**
 * Efter bekræftet resultat: kald DB-RPC der opdaterer elo_history + profiler.
 */
export async function calculateAndApplyElo(matchId, showToast, options = {}) {
  try {
    let matchResultId = options?.matchResultId || null;

    // Foretræk explicit ID fra confirm-flow; fallback bevarer gammel adfærd.
    if (!matchResultId) {
      const { data: mr, error: mrErr } = await supabase
        .from('match_results')
        .select('id')
        .eq('match_id', matchId)
        .eq('confirmed', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mrErr || !mr) {
        console.error('ELO: Kunne ikke finde bekræftet resultat:', mrErr);
        if (showToast) showToast('ELO fejl: Resultat ikke fundet.');
        return { success: false, error: 'Resultat ikke fundet.' };
      }

      matchResultId = mr.id;
    }

    const { data, error } = await supabase.rpc('apply_elo_for_match', {
      p_match_result_id: matchResultId,
    });

    if (error) {
      console.error('ELO rpc error:', error);
      if (showToast) showToast('ELO fejl: ' + error.message);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('ELO function error:', data.error);
      if (showToast) showToast('ELO fejl: ' + data.error);
      return { success: false, error: data.error };
    }

    if (data?.success) {
      if (showToast) {
        showToast(formatEloSuccessToast(data));
      }
      return { success: true, data };
    }

    return { success: false, error: 'Ukendt ELO-svar fra databasen.' };
  } catch (e) {
    console.error('ELO exception:', e);
    if (showToast) showToast('ELO fejl: ' + (e.message || 'Ukendt fejl'));
    return { success: false, error: e.message || 'Ukendt fejl' };
  }
}
