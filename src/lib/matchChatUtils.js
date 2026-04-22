import { supabase } from './supabase';

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
  const trimmed = String(content || '').trim();
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
      (payload) => onInsert(payload?.new || null)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
