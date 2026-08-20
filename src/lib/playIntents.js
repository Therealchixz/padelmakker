/**
 * Pulje-model: "Jeg vil spille" → automatisk kamp når fire passer sammen.
 *
 * Brugeren melder et konkret tidsrum ind i stedet for at skulle organisere en
 * hel kamp. Backend samler fire overlappende hensigter og sender et forslag,
 * som alle fire skal bekræfte.
 */

import { supabase } from './supabase';
import { sendPushNotificationsForUsers } from './notifications';
import { dayLabel, isoDateOffset } from './playIntentUtils';

export {
  PLAY_TIME_BANDS,
  PLAY_WINDOW_PRESETS,
  PLAY_TIME_SLOTS,
  PLAY_START_SLOTS,
  MIN_PLAY_WINDOW_MINUTES,
  timeBandByKey,
  timeToMinutes,
  minutesToTime,
  windowMinutes,
  isValidPlayWindow,
  matchingPresetKey,
  endSlotsAfter,
  clampEndToWindow,
  isoDateOffset,
  dayLabel,
  dayChoiceLabel,
  toggleSelectedDay,
  formatSelectedDays,
  shortTime,
  deadlineInfo,
} from './playIntentUtils';

/**
 * Meld dig klar i et tidsrum. Returnerer også hvor mange andre der allerede
 * står klar, så brugeren får et konkret svar med det samme.
 */
export async function createPlayIntent({ playDate, startTime, endTime, viewerId }) {
  const { data, error } = await supabase.rpc('create_play_intent', {
    p_play_date: playDate,
    p_start_time: startTime,
    p_end_time: endTime,
  });

  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'Kunne ikke melde dig klar' };

  const proposal = data.proposal || {};
  if (proposal.formed) {
    const others = (proposal.member_ids || []).filter((id) => id && id !== viewerId);
    if (others.length) {
      void sendPushNotificationsForUsers(
        others,
        'match_proposal',
        'I er 4 — bekræft jeres kamp',
        `${dayLabel(proposal.play_date)} kl. ${proposal.start_time}-${proposal.end_time}`,
        null,
        { entityType: 'match_proposal', entityId: proposal.proposal_id },
      );
    }
  }

  return {
    ok: true,
    intentId: data.intent_id,
    othersWaiting: Number(data.others_waiting) || 0,
    formed: Boolean(proposal.formed),
    proposalId: proposal.proposal_id || null,
    poolSize: Number(proposal.pool_size) || 1,
  };
}

/** Samme tidsrum på flere dage — én hensigt pr. dato. */
export async function createPlayIntents({ playDates, startTime, endTime, viewerId }) {
  const dates = [...new Set((playDates || []).filter(Boolean))].sort();
  const results = [];
  for (const playDate of dates) {
    results.push(await createPlayIntent({ playDate, startTime, endTime, viewerId }));
  }
  return results;
}

export async function cancelPlayIntent(intentId) {
  const { data, error } = await supabase.rpc('cancel_play_intent', { p_intent_id: intentId });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'Kunne ikke fortryde' };
  return { ok: true };
}

export async function respondToMatchProposal(proposalId, accept) {
  const { data, error } = await supabase.rpc('respond_to_match_proposal', {
    p_proposal_id: proposalId,
    p_accept: accept,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'Kunne ikke svare' };
  return { ok: true, status: data.status, matchId: data.match_id || null, awaiting: data.awaiting };
}

/** Mine åbne hensigter — dem jeg venter på bliver til en kamp. */
export async function fetchMyPlayIntents(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('play_intents')
    .select('id, play_date, start_time, end_time, status, proposal_id')
    .eq('user_id', userId)
    .in('status', ['open', 'proposed'])
    .gte('play_date', isoDateOffset(0))
    .order('play_date', { ascending: true });

  if (error) {
    console.warn('fetchMyPlayIntents:', error.message);
    return [];
  }
  return data || [];
}

/** Forslag jeg mangler at svare på. */
export async function fetchPendingProposals(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('match_proposal_members')
    .select('proposal_id, response, match_proposals!inner(id, play_date, start_time, end_time, region, status, expires_at)')
    .eq('user_id', userId)
    .eq('response', 'pending')
    .eq('match_proposals.status', 'pending');

  if (error) {
    console.warn('fetchPendingProposals:', error.message);
    return [];
  }

  return (data || [])
    .map((row) => row.match_proposals)
    .filter(Boolean)
    .filter((p) => new Date(p.expires_at).getTime() > Date.now());
}
