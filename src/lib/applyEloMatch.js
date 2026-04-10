import { supabase } from './supabase';

function formatTeamChanges(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  return arr.map((c) => (Number(c) > 0 ? `+${c}` : String(c))).join(', ');
}

/**
 * Efter bekræftet resultat: kald DB-RPC der opdaterer elo_history + profiler.
 */
export async function calculateAndApplyElo(matchId, showToast) {
  try {
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
      return;
    }

    const { data, error } = await supabase.rpc('apply_elo_for_match', {
      p_match_result_id: mr.id,
    });

    if (error) {
      console.error('ELO rpc error:', error);
      if (showToast) showToast('ELO fejl: ' + error.message);
      return;
    }

    if (data?.error) {
      console.error('ELO function error:', data.error);
      if (showToast) showToast('ELO fejl: ' + data.error);
      return;
    }

    if (data?.success) {
      const n = Number(data.players_updated) || 0;
      const t1 = data.team1_player_changes;
      const t2 = data.team2_player_changes;
      const marginHint =
        data.margin_multiplier != null &&
        data.games_margin != null &&
        Number(data.margin_multiplier) !== 1
          ? ` · margin ${data.games_margin} partier (×${Number(data.margin_multiplier).toFixed(2)})`
          : '';

      if (showToast) {
        if (n === 0) {
          showToast(
            'ELO blev ikke opdateret for nogen spillere. Tjek at alle fire spillere var med på kampen da resultatet blev gemt.'
          );
        } else if (Array.isArray(t1) && Array.isArray(t2)) {
          showToast(
            `ELO opdateret (${n} spillere)! Hold 1: ${formatTeamChanges(t1)} · Hold 2: ${formatTeamChanges(t2)}${marginHint} 🏆`
          );
        } else {
          showToast(`ELO opdateret for ${n} spillere!${marginHint} 🏆`);
        }
      }
    }
  } catch (e) {
    console.error('ELO exception:', e);
    if (showToast) showToast('ELO fejl: ' + (e.message || 'Ukendt fejl'));
  }
}
