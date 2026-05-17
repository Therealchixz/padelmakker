import { supabase } from './supabase';
import { rpcErrorMessage } from './rpcErrorMessage';

export async function adminCorrectLeagueMatch(matchId, winnerId, scoreText) {
  const { data, error } = await supabase.rpc('admin_correct_league_match', {
    p_match_id: matchId,
    p_winner_id: winnerId,
    p_score_text: scoreText || null,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const result = data || {};
  if (!result.ok) {
    throw new Error(result.error || 'Kunne ikke rette kampresultatet');
  }
  return result;
}
