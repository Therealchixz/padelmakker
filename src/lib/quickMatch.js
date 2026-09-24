/**
 * "Jeg vil spille" → en åben kamp.
 *
 * Før lagde "Jeg vil spille" brugeren i en usynlig pulje, og der kom kun en
 * kamp ud af det, hvis tre andre meldte sig i samme tidsrum og område. Med ca.
 * 100 brugere (9 aktive om ugen) skete det aldrig: fem tilmeldinger fra én
 * konto og ingen kampe (målt 24. sep. 2026).
 *
 * Nu opretter knappen en åben kamp uden bane. Samme vej som Opret kamp: den
 * vises under Kampe, og notify_match_watchers giver besked til dem, hvis
 * niveau og region passer. Man skal altså kun have tre til at sige ja.
 */

import { supabase } from './supabase';
import { rpcJoinOpenMatch } from './matchJoinUtils';
import { notifyMatchWatchersForMatch } from './matchWatchUtils';
import { timeToMinutes } from './playIntentUtils';
import { buildQuickMatchRow, QUICK_MATCH_MAX_WINDOW_MINUTES } from './quickMatchRow.js';

export { buildQuickMatchRow, QUICK_MATCH_MAX_WINDOW_MINUTES };

function clock(t) {
  return String(t || '').slice(0, 5);
}

/**
 * Åbne kampe samme dag, som overlapper tidsrummet og har plads. Så kan man
 * melde sig til en af dem i stedet for at oprette en kamp mere.
 */
export async function findOverlappingOpenMatches({ userId, date, start, end }) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, creator_id, date, time, time_end, court_name, current_players, max_players, match_type, status')
    .eq('date', date)
    .eq('status', 'open')
    .neq('match_type', 'closed')
    .limit(20);
  if (error) {
    console.warn('findOverlappingOpenMatches:', error.message);
    return [];
  }
  const a = timeToMinutes(clock(start));
  const b = timeToMinutes(clock(end));
  return (data || []).filter((m) => {
    if (userId && String(m.creator_id) === String(userId)) return false;
    if ((Number(m.current_players) || 0) >= (Number(m.max_players) || 4)) return false;
    const ms = timeToMinutes(clock(m.time));
    if (ms == null || a == null || b == null) return false;
    const me = timeToMinutes(clock(m.time_end)) ?? ms + 90;
    return ms < b && me > a;
  });
}

/**
 * Opret kampen, meld opretteren på hold 1 og giv besked til dem, der passer.
 * @returns {Promise<{ ok: true, matchId: string, notified: number } | { ok: false, error: string }>}
 */
export async function createQuickMatch({ user, displayName, email, date, start, end }) {
  const row = buildQuickMatchRow({ user, date, start, end });
  const { data: created, error } = await supabase.from('matches').insert(row).select('id').single();
  if (error || !created?.id) {
    return { ok: false, error: error?.message || 'Kunne ikke oprette kampen' };
  }
  try {
    await rpcJoinOpenMatch({
      matchId: created.id,
      team: 1,
      userName: displayName,
      userEmail: email,
      userEmoji: user.avatar || '🎾',
    });
  } catch (joinErr) {
    // Ingen kamp uden spillere, hvis opretteren ikke kan melde sig på.
    await supabase.from('matches').delete().eq('id', created.id);
    return { ok: false, error: joinErr?.message || 'Kunne ikke oprette kampen' };
  }
  const { notified } = await notifyMatchWatchersForMatch(created.id);
  return { ok: true, matchId: created.id, notified };
}
