/**
 * Kamp-watch: notifikation når ny åben kamp passer (region + ELO).
 * Backend: notify_match_watchers RPC. Max 8/modtager-batch, 2 kamp-discovery/dag (makker har egne 2).
 */

import { supabase } from './supabase';
import { sendPushNotificationsForUsers } from './notifications';

/**
 * @param {string} matchId
 * @returns {Promise<{ notified: number, error: string|null }>}
 */
export async function notifyMatchWatchersForMatch(matchId) {
  if (!matchId) return { notified: 0, error: null };

  const { data, error } = await supabase.rpc('notify_match_watchers', {
    p_match_id: matchId,
  });

  if (error) {
    console.warn('notify_match_watchers:', error.message);
    return { notified: 0, error: error.message };
  }

  const result = data || {};
  if (!result.ok) {
    return { notified: 0, error: result.error || 'Kunne ikke underrette watchere' };
  }

  const recipientIds = Array.isArray(result.recipient_ids)
    ? result.recipient_ids.filter(Boolean)
    : [];

  if (recipientIds.length > 0 && result.notify_title && result.notify_body) {
    void sendPushNotificationsForUsers(
      recipientIds,
      'match_watch_match',
      result.notify_title,
      result.notify_body,
      matchId,
    );
  }

  return {
    notified: Number(result.notified) || 0,
    error: null,
  };
}

/**
 * @param {boolean} enabled
 */
export async function setMatchWatchEnabled(enabled) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Ikke logget ind');

  const { error } = await supabase
    .from('profiles')
    .update({
      match_watch_enabled: Boolean(enabled),
      match_watch_at: enabled ? new Date().toISOString() : null,
    })
    .eq('id', user.id);

  if (error) throw error;
  return { enabled: Boolean(enabled) };
}
