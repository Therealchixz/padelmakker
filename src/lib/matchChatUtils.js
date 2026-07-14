import { supabase } from './supabase';
import { sanitizeText } from './platformUtils';

/**
 * Henter totalt antal beskeder per kamp i bulk — bruges til at vise
 * "Match chat (N)" label uden at brugeren først skal åbne chatten.
 *
 * @param {string[]} matchIds
 * @returns {Promise<Record<string, number>>} map fra match_id → antal beskeder
 */
export async function fetchMatchMessageCounts(matchIds) {
  const ids = Array.isArray(matchIds)
    ? matchIds.filter(Boolean).map((s) => String(s))
    : [];
  if (ids.length === 0) return {};

  const uuidIds = ids;
  const { data, error } = await supabase.rpc('fetch_match_message_counts', {
    p_match_ids: uuidIds,
  });

  if (!error) {
    const counts = {};
    for (const row of data || []) {
      if (row?.match_id != null) {
        counts[String(row.match_id)] = Number(row.message_count) || 0;
      }
    }
    return counts;
  }

  const msg = String(error.message || '').toLowerCase();
  if (
    !msg.includes('could not find the function')
    && !msg.includes('does not exist')
    && !msg.includes('schema cache')
  ) {
    throw error;
  }

  // Fallback for environments before migration is applied.
  const { data: rows, error: fallbackError } = await supabase
    .from('match_messages')
    .select('match_id')
    .in('match_id', ids);

  if (fallbackError) throw fallbackError;

  const counts = {};
  for (const row of rows || []) {
    const key = String(row.match_id);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export async function fetchMatchMessages(matchId, limit = 80) {
  if (!matchId) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));

  const { data, error } = await supabase
    .from('match_messages')
    .select('id, match_id, sender_id, sender_name, sender_avatar, content, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (error) throw error;
  return data || [];
}

export async function sendMatchMessage({
  matchId,
  senderId,
  senderName,
  senderAvatar = null,
  content,
}) {
  const trimmed = sanitizeText(String(content || '').trim());
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('match_messages')
    .insert({
      match_id: matchId,
      sender_id: senderId,
      sender_name: senderName || 'Spiller',
      sender_avatar: senderAvatar || null,
      content: trimmed,
    })
    .select('id, match_id, sender_id, sender_name, sender_avatar, content, created_at')
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToMatchMessages(matchId, onInsert) {
  if (!matchId || typeof onInsert !== 'function') return () => {};

  const channel = supabase
    .channel(`match-chat-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'match_messages',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => onInsert(payload?.new || null),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
