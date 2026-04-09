import { supabase } from './supabase';

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
      .single();

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
      const t1c = data.team1_change;
      const sign = t1c > 0 ? '+' : '';
      const n = Number(data.players_updated) || 0;
      if (showToast) {
        if (n === 0) {
          showToast(
            'ELO blev ikke opdateret for nogen spillere. Tjek at alle fire spillere var med på kampen da resultatet blev gemt.'
          );
        } else {
          const mm = data.margin_multiplier;
          const mg = data.games_margin;
          const marginHint =
            mm != null && mg != null && Number(mm) !== 1
              ? ` (sejrsmargin ${mg} partier → ×${Number(mm).toFixed(2)})`
              : '';
          showToast(
            `ELO opdateret for ${n} spillere! Hold 1: ${sign}${t1c}, Hold 2: ${t1c > 0 ? '' : '+'}${-t1c}${marginHint} 🏆`
          );
        }
      }
    }
  } catch (e) {
    console.error('ELO exception:', e);
    if (showToast) showToast('ELO fejl: ' + (e.message || 'Ukendt fejl'));
  }
}
