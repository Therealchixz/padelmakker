/**
 * Makker-watch: notifikation når en spiller søger makker og passer filteret.
 * Når to begge søger (samme region + niveau), fortæller RPC'en begge parter.
 */

import { supabase } from './supabase';
import { sendPushNotificationsForUsers, sendDiscoveryEmailsForUsers } from './notifications';

export function makkerMatchToast(matches) {
  const list = Array.isArray(matches) ? matches.filter((m) => m?.id) : [];
  if (list.length === 0) return '';
  const name = String(list[0].name || '').trim();
  if (list.length === 1) {
    return name && name !== 'En spiller'
      ? `${name} søger også makker i samme område — se Makkere.`
      : 'Vi fandt en der også søger makker — se Makkere.';
  }
  return `Vi fandt ${list.length} der også søger makker som dig — se Makkere.`;
}

/**
 * @param {string} subjectUserId — spiller der lige er blevet synlig som søgende
 */
export async function notifyMakkerWatchersForProfile(subjectUserId) {
  if (!subjectUserId) return { notified: 0, matches: [], error: null };

  const { data, error } = await supabase.rpc('notify_makker_watchers', {
    p_subject_user_id: subjectUserId,
  });

  if (error) {
    console.warn('notify_makker_watchers:', error.message);
    return { notified: 0, matches: [], error: error.message };
  }

  const result = data || {};
  if (!result.ok) {
    return { notified: 0, matches: [], error: result.error || 'Kunne ikke underrette watchere' };
  }

  const recipientIds = Array.isArray(result.recipient_ids)
    ? result.recipient_ids.filter(Boolean)
    : [];
  const matchRecipientIds = Array.isArray(result.match_recipient_ids)
    ? result.match_recipient_ids.filter(Boolean)
    : [];
  const matchIdSet = new Set(matchRecipientIds);
  const watcherIds = recipientIds.filter((id) => !matchIdSet.has(id));
  const matches = Array.isArray(result.matches) ? result.matches : [];
  const opts = { entityType: 'profile', entityId: subjectUserId };

  if (matchRecipientIds.length > 0 && result.match_title && result.notify_body) {
    void sendPushNotificationsForUsers(
      matchRecipientIds,
      'makker_suggestion',
      result.match_title,
      result.notify_body,
      null,
      opts,
    );
    void sendDiscoveryEmailsForUsers(
      matchRecipientIds,
      'makker_suggestion',
      result.match_title,
      result.notify_body,
      null,
      opts,
    );
  }

  if (watcherIds.length > 0 && result.notify_title && result.notify_body) {
    void sendPushNotificationsForUsers(
      watcherIds,
      'makker_suggestion',
      result.notify_title,
      result.notify_body,
      null,
      opts,
    );
    void sendDiscoveryEmailsForUsers(
      watcherIds,
      'makker_suggestion',
      result.notify_title,
      result.notify_body,
      null,
      opts,
    );
  }

  return {
    notified: Number(result.notified) || 0,
    matches,
    error: null,
  };
}
