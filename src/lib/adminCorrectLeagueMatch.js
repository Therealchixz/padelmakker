import { supabase } from './supabase';

export async function adminCorrectLeagueMatch(matchId, winnerId, scoreText) {
  const { data, error } = await supabase.rpc('admin_correct_league_match', {
    p_match_id: matchId,
    p_winner_id: winnerId,
    p_score_text: scoreText || null,
  });
  if (error) throw error;
  const result = data || {};
  if (!result.ok) {
    throw new Error(result.error || 'Kunne ikke rette kampresultatet');
  }
  return result;
}
