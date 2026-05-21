/**
 * Makker-watch: notifikation når en spiller søger makker og passer filteret.
 */

import { supabase } from './supabase';
import { sendPushNotificationsForUsers } from './notifications';

/**
 * @param {string} subjectUserId — spiller der lige er blevet synlig som søgende
 */
export async function notifyMakkerWatchersForProfile(subjectUserId) {
  if (!subjectUserId) return { notified: 0, error: null };

  const { data, error } = await supabase.rpc('notify_makker_watchers', {
    p_subject_user_id: subjectUserId,
  });

  if (error) {
    console.warn('notify_makker_watchers:', error.message);
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
      'makker_suggestion',
      result.notify_title,
      result.notify_body,
      null,
      { entityType: 'profile', entityId: subjectUserId },
    );
  }

  return {
    notified: Number(result.notified) || 0,
    error: null,
  };
}
