import { supabase } from './supabase';
import { rpcErrorMessage } from './rpcErrorMessage';

export async function adminCorrectAmericanoTournament(tournamentId, matches) {
  const { data, error } = await supabase.rpc('admin_correct_americano_tournament', {
    p_tournament_id: tournamentId,
    p_matches: matches,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const result = data || {};
  if (!result.ok) {
    throw new Error(result.error || 'Kunne ikke rette turneringsresultater');
  }
  return result;
}
