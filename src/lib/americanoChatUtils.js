/**
 * Chat i Americano/Mexicano (tabellen americano_messages).
 * Kun tilmeldte og opretteren kan læse og skrive (RLS).
 */
import { supabase } from './supabase';
import { sanitizeText } from './platformUtils';
import { createNotificationsForUsers } from './notifications';

const COLS = 'id, tournament_id, sender_id, sender_name, sender_avatar, content, created_at';

export async function fetchAmericanoMessages(tournamentId, limit = 120) {
  if (!tournamentId) return [];
  const { data, error } = await supabase
    .from('americano_messages')
    .select(COLS)
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(Number(limit) || 120, 200)));
  if (error) throw error;
  return data || [];
}

/**
 * @param {{ tournamentId: string, senderId: string, senderName?: string, senderAvatar?: string | null, content: string }} opts
 */
export async function sendAmericanoMessage({ tournamentId, senderId, senderName, senderAvatar = null, content }) {
  const trimmed = sanitizeText(String(content || '').trim()).slice(0, 1000);
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('americano_messages')
    .insert({
      tournament_id: tournamentId,
      sender_id: senderId,
      sender_name: String(senderName || 'Spiller').slice(0, 80),
      sender_avatar: senderAvatar || null,
      content: trimmed,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * @param {string} tournamentId
 * @param {(row: any) => void} onInsert
 */
export function subscribeToAmericanoMessages(tournamentId, onInsert) {
  if (!tournamentId || typeof onInsert !== 'function') return () => {};
  const channel = supabase
    .channel(`americano-chat-${tournamentId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'americano_messages', filter: `tournament_id=eq.${tournamentId}` },
      (payload) => onInsert(payload?.new || null),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Giv de andre besked (samme slags notifikation og push som kamp-chat).
 * Et tryk på notifikationen åbner turneringen.
 *
 * @param {{ tournamentId: string, recipientIds: string[], senderName?: string, content: string }} opts
 */
export async function notifyAmericanoChat({ tournamentId, recipientIds, senderName, content }) {
  const ids = [...new Set((recipientIds || []).filter(Boolean).map(String))];
  if (!tournamentId || !ids.length) return null;
  const text = String(content || '');
  const preview = text.length > 90 ? `${text.slice(0, 87)}...` : text;
  return createNotificationsForUsers(
    ids,
    'match_chat',
    'Ny besked i Americano-chat 💬',
    `${senderName || 'Spiller'}: ${preview}`,
    null,
    { entityType: 'americano', entityId: tournamentId },
  );
}
