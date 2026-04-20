import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

/** Hent alle samtaler for userId — én per samtalepartner, sorteret nyeste først. */
export async function fetchConversations(userId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, created_at, is_read')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const convoMap = {};
  for (const msg of data || []) {
    const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (!convoMap[otherId]) {
      convoMap[otherId] = { otherId, lastMessage: msg, unread: 0 };
    }
    if (msg.receiver_id === userId && !msg.is_read) {
      convoMap[otherId].unread++;
    }
  }

  return Object.values(convoMap).sort(
    (a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
  );
}

/** Hent alle beskeder i samtalen mellem to brugere, kronologisk. */
export async function fetchMessages(userId, otherId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, created_at, is_read')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Send en besked. */
export async function sendMessage(senderId, receiverId, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content: content.trim() })
    .select('id, sender_id, receiver_id, content, created_at, is_read')
    .single();
  if (error) throw error;
  return data;
}

/** Markér alle ulæste beskeder fra otherId til userId som læste. */
export async function markMessagesRead(userId, otherId) {
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('receiver_id', userId)
    .eq('sender_id', otherId)
    .eq('is_read', false);
}

/** Antal ulæste indgående beskeder for userId. */
export async function fetchUnreadMessageCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count || 0;
}

/**
 * Hook: returnerer antal ulæste beskeder og opdaterer live via Supabase realtime.
 */
export function useUnreadMessageCount(userId) {
  const [count, setCount] = useState(0);
  const debounceTimer = useRef(null);

  const refresh = useCallback(async () => {
    const n = await fetchUnreadMessageCount(userId);
    setCount(n);
  }, [userId]);

  const debouncedRefresh = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(refresh, 300);
  }, [refresh]);

  useEffect(() => {
    refresh();
    if (!userId) return;

    const channel = supabase
      .channel(`msg-unread-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        () => debouncedRefresh()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh, debouncedRefresh]);

  return count;
}
