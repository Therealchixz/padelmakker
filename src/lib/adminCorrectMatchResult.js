import { supabase } from './supabase';

export async function adminCorrectMatchResultAndRecalcElo(matchResultId, resultFields) {
  const { data, error } = await supabase.rpc('admin_correct_match_result_and_recalc_elo', {
    p_match_result_id: matchResultId,
    p_result: resultFields,
  });
  if (error) throw error;
  const result = data || {};
  if (!result.ok) {
    throw new Error(result.error || 'Kunne ikke rette resultatet');
  }
  return result;
}
